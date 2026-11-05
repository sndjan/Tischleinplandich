import type { PlannedMeal, Recipe } from "@/types/database";

/**
 * The recipe a planned meal shows. Meals without a recipe (eating out, migration
 * 020) get a stand-in with their label and hand-entered calories, so cards and
 * day totals treat them like any other meal; `isRecipe` is false for those.
 */
export function getMealRecipe(
  meal: Pick<PlannedMeal, "id" | "recipe_id" | "label" | "calories">,
  recipesById: Map<string, Recipe>,
): { recipe: Recipe; isRecipe: boolean } | undefined {
  if (meal.recipe_id) {
    const recipe = recipesById.get(meal.recipe_id);
    return recipe ? { recipe, isRecipe: true } : undefined;
  }

  if (!meal.label) return undefined;

  const standIn = {
    id: `meal-${meal.id}`,
    name: meal.label,
    calories: meal.calories ?? null,
    protein: null,
    carbs: null,
    fats: null,
    serving_size: 1,
    ingredients: "",
    preparation_steps: null,
    image_url: null,
    source_url: null,
    prep_time: null,
  } as unknown as Recipe;

  return { recipe: standIn, isRecipe: false };
}

/**
 * A planned meal after its recipe went away (deleted, or its owner left the
 * household): a meal without a recipe that keeps the name and calories per
 * portion. Mirrors detach_deleted_recipe in migration 030.
 */
export function detachRecipe<T extends Pick<PlannedMeal, "recipe_id" | "label" | "calories">>(
  meal: T,
  recipe: Pick<Recipe, "name" | "calories">,
): T {
  const calories = recipe.calories != null && recipe.calories >= 0 && recipe.calories <= 10000 ? recipe.calories : null;
  return { ...meal, recipe_id: null, label: recipe.name.trim().slice(0, 80).trim() || "Rezept", calories };
}
