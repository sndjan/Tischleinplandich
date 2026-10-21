import { createClient } from '@/lib/supabase/client';
import { getRecipeImagePathFromUrl, RECIPE_IMAGE_BUCKET } from '@/lib/recipe-images';
import type { Recipe } from '@/types/database';

/**
 * Delete a recipe together with its uploaded image.
 */
export async function deleteRecipe(recipe: Pick<Recipe, 'id' | 'image_url'>): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from('recipes').delete().eq('id', recipe.id);

  if (error) throw error;

  const imagePath = getRecipeImagePathFromUrl(recipe.image_url);

  if (imagePath) {
    await supabase.storage.from(RECIPE_IMAGE_BUCKET).remove([imagePath]);
  }
}
