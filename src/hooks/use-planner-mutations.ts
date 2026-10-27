"use client";

import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { deleteRecipe } from "@/lib/recipes";
import { showUndoToast } from "@/lib/undo-toast";
import type { MealType, PlannedMeal, Recipe } from "@/types/database";
import {
  getCurrentWeekStartDateString,
  isPendingId,
  PENDING_ID_PREFIX,
  queryKeys,
  useUserId,
  type RecipesData,
  type WeekData,
} from "./use-planner-data";

export type AddMealInput = {
  recipeId: string;
  dayIndex: number;
  mealType: MealType;
  servingSize: number;
  // A fixed slot holds one meal; the meal already in it is replaced.
  replaceMealId?: string;
};

async function getOrCreateMealPlanId(userId: string, weekStart: string): Promise<string> {
  const supabase = createClient();
  const { data: existing, error } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("week_start_date", weekStart)
    .maybeSingle<{ id: string }>();

  if (error) throw error;
  if (existing) return existing.id;

  const { data: created, error: createError } = await supabase
    .from("meal_plans")
    .insert({ user_id: userId, week_start_date: weekStart })
    .select("id")
    .single<{ id: string }>();

  if (createError || !created) throw createError ?? new Error("Plan not created");
  return created.id;
}

/**
 * Adds a meal to this week's plan. It appears immediately; the day totals and
 * shopping list update with it while the server write runs in the background.
 */
export function useAddMeal() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const weekStart = getCurrentWeekStartDateString();
  const weekKey = queryKeys.week(userId ?? "", weekStart);

  const mutation = useMutation({
    mutationFn: async (input: AddMealInput & { pendingId: string }) => {
      if (!userId) throw new Error("Not signed in");

      const supabase = createClient();
      const mealPlanId =
        queryClient.getQueryData<WeekData>(weekKey)?.mealPlanId ??
        (await getOrCreateMealPlanId(userId, weekStart));

      if (input.replaceMealId && !isPendingId(input.replaceMealId)) {
        const { error } = await supabase
          .from("planned_meals")
          .delete()
          .eq("id", input.replaceMealId);
        if (error) throw error;
      }

      const { data, error } = await supabase
        .from("planned_meals")
        .insert({
          meal_plan_id: mealPlanId,
          recipe_id: input.recipeId,
          day_of_week: input.dayIndex,
          meal_type: input.mealType,
          serving_size: input.servingSize,
        })
        .select("*")
        .single<PlannedMeal>();

      if (error || !data) throw error ?? new Error("Meal not added");
      return data;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: weekKey });
      const previous = queryClient.getQueryData<WeekData>(weekKey);
      const now = new Date().toISOString();

      const pendingMeal: PlannedMeal = {
        id: input.pendingId,
        meal_plan_id: previous?.mealPlanId ?? "",
        recipe_id: input.recipeId,
        day_of_week: input.dayIndex,
        meal_type: input.mealType,
        serving_size: input.servingSize,
        created_at: now,
        updated_at: now,
      } as PlannedMeal;

      queryClient.setQueryData<WeekData>(weekKey, (current) => ({
        mealPlanId: current?.mealPlanId ?? null,
        meals: [
          ...(current?.meals ?? []).filter((meal) => meal.id !== input.replaceMealId),
          pendingMeal,
        ],
      }));

      return { previous };
    },
    onSuccess: (savedMeal, input) => {
      queryClient.setQueryData<WeekData>(weekKey, (current) => ({
        mealPlanId: savedMeal.meal_plan_id,
        meals: (current?.meals ?? []).map((meal) =>
          meal.id === input.pendingId ? savedMeal : meal,
        ),
      }));
    },
    onError: (error, _input, context) => {
      console.error(error);
      if (context?.previous) {
        queryClient.setQueryData(weekKey, context.previous);
      }
      toast.error("Hinzufügen fehlgeschlagen");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: weekKey }),
  });

  return useCallback(
    (input: AddMealInput) =>
      mutation.mutate({ ...input, pendingId: `${PENDING_ID_PREFIX}${crypto.randomUUID()}` }),
    [mutation],
  );
}

/**
 * Removes a meal right away and offers undo; the delete is sent once the undo
 * window has passed.
 */
export function useRemoveMeal(recipesById: Map<string, Recipe>) {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const weekKey = queryKeys.week(userId ?? "", getCurrentWeekStartDateString());

  const deleteMutation = useMutation({
    mutationFn: async (mealId: string) => {
      const { error } = await createClient().from("planned_meals").delete().eq("id", mealId);
      if (error) throw error;
    },
    onError: (error) => {
      console.error(error);
      toast.error("Entfernen fehlgeschlagen");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: weekKey }),
  });

  return useCallback(
    (meal: PlannedMeal) => {
      // Still being saved: there is no server row to delete yet.
      if (isPendingId(meal.id)) return;

      const hide = (current?: WeekData) => ({
        mealPlanId: current?.mealPlanId ?? null,
        meals: (current?.meals ?? []).filter((entry) => entry.id !== meal.id),
      });

      queryClient.setQueryData<WeekData>(weekKey, hide);
      const recipeName = recipesById.get(meal.recipe_id)?.name;

      showUndoToast({
        message: recipeName ? `„${recipeName}“ entfernt` : "Mahlzeit entfernt",
        onUndo: () =>
          queryClient.setQueryData<WeekData>(weekKey, (current) => ({
            mealPlanId: current?.mealPlanId ?? null,
            meals: [...(current?.meals ?? []), meal],
          })),
        onCommit: () => deleteMutation.mutate(meal.id),
      });
    },
    [queryClient, weekKey, recipesById, deleteMutation],
  );
}

/**
 * Deletes a recipe right away (from the library and the week) with undo.
 */
export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const recipesKey = queryKeys.recipes(userId ?? "");
  const weekKey = queryKeys.week(userId ?? "", getCurrentWeekStartDateString());

  const deleteMutation = useMutation({
    mutationFn: (recipe: Recipe) => deleteRecipe(recipe),
    onError: (error) => {
      console.error(error);
      toast.error("Löschen fehlgeschlagen");
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: recipesKey }),
        queryClient.invalidateQueries({ queryKey: weekKey }),
      ]),
  });

  return useCallback(
    (recipe: Recipe) => {
      const previousRecipes = queryClient.getQueryData<RecipesData>(recipesKey);
      const previousWeek = queryClient.getQueryData<WeekData>(weekKey);

      queryClient.setQueryData<RecipesData>(recipesKey, (current) =>
        current
          ? { ...current, recipes: current.recipes.filter((entry) => entry.id !== recipe.id) }
          : current,
      );
      // Planned meals of a deleted recipe are deleted with it in the database.
      queryClient.setQueryData<WeekData>(weekKey, (current) =>
        current
          ? { ...current, meals: current.meals.filter((meal) => meal.recipe_id !== recipe.id) }
          : current,
      );

      showUndoToast({
        message: `„${recipe.name}“ gelöscht`,
        onUndo: () => {
          queryClient.setQueryData(recipesKey, previousRecipes);
          queryClient.setQueryData(weekKey, previousWeek);
        },
        onCommit: () => deleteMutation.mutate(recipe),
      });
    },
    [queryClient, recipesKey, weekKey, deleteMutation],
  );
}
