import { createClient, getSessionUser } from "@/lib/supabase/client";
import {
  createRecipeImagePath,
  getRecipeImagePathFromUrl,
  RECIPE_IMAGE_BUCKET,
} from "@/lib/recipe-images";
import { draftFromEditable, type EditableRecipe } from "@/lib/editable-recipe";
import type { Recipe } from "@/types/database";

export class SaveRecipeError extends Error {}

type ImageChange =
  | { kind: "keep" }
  | { kind: "remove" }
  | { kind: "replace"; file: File };

const uniqueTags = (tags: string[]) => {
  const seen = new Set<string>();

  return tags
    .map((tag) => tag.trim())
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (!tag || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export async function syncRecipeTags(recipeId: string, userId: string, tags: string[]) {
  const supabase = createClient();
  const tagNames = uniqueTags(tags);

  const { error: deleteError } = await supabase
    .from("recipe_tags")
    .delete()
    .eq("recipe_id", recipeId);

  if (deleteError) throw deleteError;
  if (tagNames.length === 0) return;

  const { data: existingTags, error: existingTagsError } = await supabase
    .from("tags")
    .select("id, name")
    .eq("user_id", userId);

  if (existingTagsError) throw existingTagsError;

  const tagIdsByName = new Map(
    (existingTags ?? []).map((tag) => [tag.name.toLowerCase(), tag.id]),
  );
  const missingNames = tagNames.filter((name) => !tagIdsByName.has(name.toLowerCase()));

  if (missingNames.length > 0) {
    const { data: createdTags, error: createError } = await supabase
      .from("tags")
      .insert(missingNames.map((name) => ({ user_id: userId, name })))
      .select("id, name");

    if (createError) throw createError;

    for (const tag of createdTags ?? []) {
      tagIdsByName.set(tag.name.toLowerCase(), tag.id);
    }
  }

  const tagIds = tagNames
    .map((name) => tagIdsByName.get(name.toLowerCase()))
    .filter((id): id is string => Boolean(id));

  const { error: linkError } = await supabase
    .from("recipe_tags")
    .insert(tagIds.map((tagId) => ({ recipe_id: recipeId, tag_id: tagId })));

  if (linkError) throw linkError;
}

/**
 * Creates or updates a recipe with its cover image and tags.
 * Returns whether the tags could be saved (the recipe itself is saved either way).
 */
export async function saveRecipe(
  recipe: EditableRecipe,
  image: ImageChange,
  existing?: Recipe | null,
): Promise<{ tagsSaved: boolean }> {
  const supabase = createClient();
  const user = await getSessionUser();

  if (!user) throw new SaveRecipeError("Nicht angemeldet");

  const draft = draftFromEditable(recipe);

  if (!draft.name) throw new SaveRecipeError("Name fehlt");
  if (!draft.ingredients) throw new SaveRecipeError("Mindestens eine Zutat fehlt");

  let imageUrl = existing?.image_url ?? null;
  let uploadedImagePath: string | null = null;
  let previousImagePath: string | null = null;

  if (image.kind === "replace") {
    const imagePath = createRecipeImagePath(user.id, image.file.name);
    const { error: uploadError } = await supabase.storage
      .from(RECIPE_IMAGE_BUCKET)
      .upload(imagePath, image.file, {
        cacheControl: "3600",
        contentType: image.file.type,
        upsert: false,
      });

    if (uploadError) throw new SaveRecipeError(uploadError.message || "Bild-Upload fehlgeschlagen");

    uploadedImagePath = imagePath;
    previousImagePath = getRecipeImagePathFromUrl(existing?.image_url ?? null);
    imageUrl = supabase.storage.from(RECIPE_IMAGE_BUCKET).getPublicUrl(imagePath).data.publicUrl;
  } else if (image.kind === "remove") {
    imageUrl = null;
    previousImagePath = getRecipeImagePathFromUrl(existing?.image_url ?? null);
  }

  const payload = {
    name: draft.name,
    ingredients: draft.ingredients,
    preparation_steps: draft.preparation_steps || null,
    source_url: draft.source_url || null,
    prep_time: draft.prep_time || null,
    calories: draft.calories,
    protein: draft.protein,
    carbs: draft.carbs,
    fats: draft.fats,
    serving_size: draft.serving_size || 1,
    image_url: imageUrl,
    is_public: recipe.is_public,
  };

  let recipeId: string;

  try {
    if (existing) {
      const { error } = await supabase
        .from("recipes")
        .update(payload)
        .eq("id", existing.id)
        .eq("user_id", user.id);

      if (error) throw new SaveRecipeError(error.message);
      recipeId = existing.id;
    } else {
      const { data, error } = await supabase
        .from("recipes")
        .insert({ user_id: user.id, ...payload })
        .select("id")
        .single<{ id: string }>();

      if (error || !data) throw new SaveRecipeError(error?.message || "Speichern fehlgeschlagen");
      recipeId = data.id;
    }
  } catch (error) {
    if (uploadedImagePath) {
      await supabase.storage.from(RECIPE_IMAGE_BUCKET).remove([uploadedImagePath]);
    }
    throw error;
  }

  if (previousImagePath && previousImagePath !== uploadedImagePath) {
    await supabase.storage.from(RECIPE_IMAGE_BUCKET).remove([previousImagePath]);
  }

  try {
    await syncRecipeTags(recipeId, user.id, recipe.tags);
    return { tagsSaved: true };
  } catch (error) {
    console.error(error);
    return { tagsSaved: false };
  }
}
