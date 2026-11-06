"use client";

import { useHouseholdRecipesQuery } from "@/hooks/use-planner-data";
import { RecipeList } from "./recipe-list";
import { useShowNutrition } from "./nutrition-target-settings";
import { useShowBalance } from "./balance-display";
import type { HouseholdRecipe } from "@/hooks/use-planner-data";

/**
 * The "Haushalt" tab: the other members' recipes. They plan directly (also by
 * dragging onto a day); changing one needs a copy first, from the recipe page.
 */
export function HouseholdRecipes() {
  const { data, isPending } = useHouseholdRecipesQuery();
  const showNutrition = useShowNutrition();
  const showBalance = useShowBalance();
  const recipes = data ?? [];

  const tagsById: Record<string, string[]> = {};
  for (const recipe of recipes) tagsById[recipe.id] = recipe.tags;

  return (
    <RecipeList
      recipes={recipes}
      recipeTagsById={tagsById}
      loading={isPending}
      showNutrition={showNutrition}
      showBalance={showBalance}
      ownRecipes={false}
      emptyText="Die anderen haben noch keine Rezepte. Sobald jemand eins anlegt, erscheint es hier."
      cardFooter={(recipe) => (
        <p className="truncate text-xs text-brand-tertiary">von {(recipe as HouseholdRecipe).author_name || "jemandem"}</p>
      )}
    />
  );
}
