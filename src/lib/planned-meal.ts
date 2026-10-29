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
