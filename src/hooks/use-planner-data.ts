"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/client";
import type { PlannedMeal, Recipe } from "@/types/database";

export function getCurrentWeekStartDateString(): string {
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  weekStart.setHours(0, 0, 0, 0);
  return weekStart.toISOString().split("T")[0];
}

// Meals added optimistically carry this id prefix until the server row arrives.
export const PENDING_ID_PREFIX = "pending-";

export const isPendingId = (id: string) => id.startsWith(PENDING_ID_PREFIX);

export const queryKeys = {
  recipes: (userId: string) => ["recipes", userId] as const,
  week: (userId: string, weekStart: string) => ["week", userId, weekStart] as const,
  nutritionTargets: (userId: string) => ["nutrition-targets", userId] as const,
  pantryStaples: (userId: string) => ["pantry-staples", userId] as const,
  profile: (userId: string) => ["profile", userId] as const,
  discover: (search: string) => ["discover", search] as const,
};

export type ProfileData = {
  displayName: string | null;
  // False until migration 011 adds users.display_name and the sharing columns.
  sharingReady: boolean;
};

// Postgres "undefined column": the sharing migration has not been run yet.
export const isMissingColumnError = (error: { code?: string } | null) => error?.code === "42703";

export type RecipesData = {
  recipes: Recipe[];
  tagsById: Record<string, string[]>;
};

export type WeekData = {
  mealPlanId: string | null;
  meals: PlannedMeal[];
};

const getTagNames = (recipeTags: unknown): string[] => {
  const names = new Map<string, string>();

  for (const entry of (recipeTags ?? []) as Array<{ tags: unknown }>) {
    const tag = Array.isArray(entry.tags) ? entry.tags[0] : entry.tags;
    const name = (tag as { name?: string } | null)?.name;

    if (name && !names.has(name.toLowerCase())) {
      names.set(name.toLowerCase(), name);
    }
  }

  return [...names.values()].sort((a, b) => a.localeCompare(b));
};

export async function fetchRecipes(userId: string): Promise<RecipesData> {
  // Tags come along in the same request instead of one request per recipe.
  const { data, error } = await createClient()
    .from("recipes")
    .select("*, recipe_tags(tags(name))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const recipes: Recipe[] = [];
  const tagsById: Record<string, string[]> = {};

  for (const row of (data ?? []) as Array<Recipe & { recipe_tags?: unknown }>) {
    const { recipe_tags: recipeTags, ...recipe } = row;
    recipes.push(recipe);
    tagsById[recipe.id] = getTagNames(recipeTags);
  }

  return { recipes, tagsById };
}

export async function fetchWeek(userId: string, weekStart: string): Promise<WeekData> {
  const { data, error } = await createClient()
    .from("meal_plans")
    .select("id, planned_meals(*)")
    .eq("user_id", userId)
    .eq("week_start_date", weekStart)
    .maybeSingle();

  if (error) throw error;

  const plan = data as { id: string; planned_meals: PlannedMeal[] | null } | null;

  return { mealPlanId: plan?.id ?? null, meals: plan?.planned_meals ?? [] };
}

/**
 * The signed-in user's id, or null while the session is loading or signed out.
 */
export function useUserId(): string | null {
  const { user } = useAuth();
  return user?.id ?? null;
}

export function useRecipesQuery() {
  const userId = useUserId();

  return useQuery({
    queryKey: queryKeys.recipes(userId ?? ""),
    queryFn: () => fetchRecipes(userId!),
    enabled: Boolean(userId),
  });
}

export function useWeekQuery() {
  const userId = useUserId();
  const weekStart = getCurrentWeekStartDateString();

  return useQuery({
    queryKey: queryKeys.week(userId ?? "", weekStart),
    queryFn: () => fetchWeek(userId!, weekStart),
    enabled: Boolean(userId),
  });
}

/**
 * Everything the week view and shopping list need, from the shared cache.
 * `loading` is only true when nothing is cached yet, so later visits render
 * the last known data immediately while it refreshes in the background.
 */
export function useMealPlanData() {
  const recipesQuery = useRecipesQuery();
  const weekQuery = useWeekQuery();

  const recipes = recipesQuery.data?.recipes;
  const meals = weekQuery.data?.meals;

  return useMemo(
    () => ({
      recipes: recipes ?? [],
      tagsById: recipesQuery.data?.tagsById ?? {},
      plannedMeals: meals ?? [],
      loading: recipesQuery.isPending || weekQuery.isPending,
      refreshing: recipesQuery.isFetching || weekQuery.isFetching,
    }),
    [recipes, meals, recipesQuery.data?.tagsById, recipesQuery.isFetching, weekQuery.isFetching],
  );
}

export function useProfileQuery() {
  const userId = useUserId();

  return useQuery({
    queryKey: queryKeys.profile(userId ?? ""),
    enabled: Boolean(userId),
    queryFn: async (): Promise<ProfileData> => {
      const { data, error } = await createClient()
        .from("users")
        .select("display_name")
        .eq("id", userId!)
        .maybeSingle();

      if (isMissingColumnError(error)) return { displayName: null, sharingReady: false };
      if (error) throw error;

      return { displayName: data?.display_name ?? null, sharingReady: true };
    },
  });
}
