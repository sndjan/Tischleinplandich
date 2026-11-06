"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  queryKeys,
  useActiveHousehold,
  useHouseholdRecipesQuery,
  useRecipesQuery,
  useWeekQuery,
  useWeekScope,
  type WeekData,
} from "./use-planner-data";

/**
 * Keeps the shown week in step with the other members (and the user's other
 * devices): changes to its plan arrive through Supabase Realtime (migration 030)
 * and trigger a refetch. Members joining or leaving show up on the next refresh.
 */
export function useWeekRealtime() {
  const queryClient = useQueryClient();
  const { householdId, weekStart, queryKey } = useWeekScope();
  const { data: households, isShared } = useActiveHousehold();
  const ready = households?.ready === true;
  const { data: week } = useWeekQuery();
  const mealPlanId = week?.mealPlanId ?? null;
  const { data: own } = useRecipesQuery();
  const { data: memberRecipes, isFetching: fetchingMemberRecipes } = useHouseholdRecipesQuery();

  const lastMissingRef = useRef("");

  // A member planned a recipe they added after the list was loaded. Each set of
  // unknown ids is fetched for once, so a recipe that stays unknown can't loop.
  useEffect(() => {
    if (!isShared || !householdId || !week || !own || !memberRecipes || fetchingMemberRecipes) return;
    const known = new Set([...own.recipes, ...memberRecipes].map((recipe) => recipe.id));
    const missing = week.meals
      .flatMap((meal) => (meal.recipe_id && !known.has(meal.recipe_id) ? [meal.recipe_id] : []))
      .sort()
      .join(",");
    if (!missing || missing === lastMissingRef.current) return;
    lastMissingRef.current = missing;
    void queryClient.invalidateQueries({ queryKey: queryKeys.householdRecipes(householdId) });
  }, [queryClient, isShared, householdId, week, own, memberRecipes, fetchingMemberRecipes]);

  useEffect(() => {
    if (!ready || !householdId) return;

    const supabase = createClient();
    let timer: number | undefined;
    // Several rows often change at once (e.g. replacing a meal); refetch once.
    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void queryClient.invalidateQueries({ queryKey }), 300);
    };

    const channel = supabase.channel(`week:${householdId}:${weekStart}`);

    // Someone else planned the first meal of this week, which creates its plan.
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "meal_plans", filter: `household_id=eq.${householdId}` },
      refresh,
    );

    if (mealPlanId) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "planned_meals", filter: `meal_plan_id=eq.${mealPlanId}` },
        refresh,
      );
      // Deletes can't be filtered and only carry the id, so check it against the week.
      channel.on("postgres_changes", { event: "DELETE", schema: "public", table: "planned_meals" }, (payload) => {
        const id = (payload.old as { id?: string } | null)?.id;
        const week = queryClient.getQueryData<WeekData>(queryKey);
        if (id && week?.meals.some((meal) => meal.id === id)) refresh();
      });
    }

    channel.subscribe();

    return () => {
      window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [queryClient, ready, householdId, weekStart, mealPlanId, queryKey]);
}
