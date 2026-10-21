"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient, getSessionUser } from "@/lib/supabase/client";
import type { PlannedMeal, Recipe } from "@/types/database";

export function getCurrentWeekStartDateString(): string {
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  weekStart.setHours(0, 0, 0, 0);
  return weekStart.toISOString().split("T")[0];
}

export interface MealPlanData {
  recipes: Recipe[];
  plannedMeals: PlannedMeal[];
  loading: boolean;
  reload: () => Promise<void>;
}

/**
 * Centralized fetch for everything the week view and shopping list need: recipes
 * and this week's planned meals. Avoids each consumer independently re-fetching
 * the same overlapping data.
 */
export function useMealPlanData(): MealPlanData {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [plannedMeals, setPlannedMeals] = useState<PlannedMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // `loading` only covers the initial fetch. Reloads after adding/removing a meal keep
  // showing the current data until the fresh rows arrive, so the week view doesn't flash.
  const load = useCallback(async () => {
    try {
      const user = await getSessionUser();

      if (!user) return;

      const { data: recipesData } = await supabase
        .from("recipes")
        .select("*")
        .eq("user_id", user.id);

      setRecipes((recipesData ?? []) as Recipe[]);

      const weekStartDateStr = getCurrentWeekStartDateString();
      const { data: mealPlansData } = await supabase
        .from("meal_plans")
        .select("*")
        .eq("user_id", user.id)
        .eq("week_start_date", weekStartDateStr);

      if (mealPlansData && mealPlansData.length > 0 && mealPlansData[0]) {
        const currentMealPlanId = (mealPlansData[0] as { id: string }).id;

        const { data: mealsData } = await supabase
          .from("planned_meals")
          .select("*")
          .eq("meal_plan_id", currentMealPlanId);

        setPlannedMeals((mealsData ?? []) as PlannedMeal[]);
      } else {
        setPlannedMeals([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {
    recipes,
    plannedMeals,
    loading,
    reload: load,
  };
}
