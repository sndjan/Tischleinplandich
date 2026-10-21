"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient, getSessionUser } from "@/lib/supabase/client";
import type { FoodItem, PlannedMeal, Recipe, RecipeIngredient } from "@/types/database";

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
  recipeIngredientsByRecipeId: Record<string, RecipeIngredient[]>;
  foodItemsById: Record<string, FoodItem>;
  loading: boolean;
  reload: () => Promise<void>;
}

/**
 * Centralized fetch for everything the week view and Health Card need: recipes,
 * this week's planned meals, structured recipe ingredients, and the user's food
 * database. Avoids each consumer (week view, Health Card) independently re-fetching
 * the same overlapping data.
 */
export function useMealPlanData(): MealPlanData {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [plannedMeals, setPlannedMeals] = useState<PlannedMeal[]>([]);
  const [recipeIngredientsByRecipeId, setRecipeIngredientsByRecipeId] = useState<
    Record<string, RecipeIngredient[]>
  >({});
  const [foodItemsById, setFoodItemsById] = useState<Record<string, FoodItem>>({});
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const user = await getSessionUser();

      if (!user) return;

      const [{ data: recipesData }, { data: foodItemsData }] = await Promise.all([
        supabase.from("recipes").select("*").eq("user_id", user.id),
        supabase.from("food_items").select("*").eq("user_id", user.id),
      ]);

      const fetchedRecipes = (recipesData ?? []) as Recipe[];
      setRecipes(fetchedRecipes);

      const nextFoodItemsById: Record<string, FoodItem> = {};
      (foodItemsData ?? []).forEach((item) => {
        const foodItem = item as FoodItem;
        nextFoodItemsById[foodItem.id] = foodItem;
      });
      setFoodItemsById(nextFoodItemsById);

      const recipeIds = fetchedRecipes.map((recipe) => recipe.id);

      if (recipeIds.length > 0) {
        const { data: ingredientsData } = await supabase
          .from("recipe_ingredients")
          .select("*")
          .in("recipe_id", recipeIds)
          .order("display_order", { ascending: true });

        const nextByRecipeId: Record<string, RecipeIngredient[]> = {};
        (ingredientsData ?? []).forEach((row) => {
          const ingredient = row as RecipeIngredient;
          if (!nextByRecipeId[ingredient.recipe_id]) {
            nextByRecipeId[ingredient.recipe_id] = [];
          }
          nextByRecipeId[ingredient.recipe_id].push(ingredient);
        });
        setRecipeIngredientsByRecipeId(nextByRecipeId);
      } else {
        setRecipeIngredientsByRecipeId({});
      }

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
    recipeIngredientsByRecipeId,
    foodItemsById,
    loading,
    reload: load,
  };
}
