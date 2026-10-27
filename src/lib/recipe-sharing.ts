"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createClient, getSessionUser } from "@/lib/supabase/client";
import { createRecipeImagePath, getRecipeImagePathFromUrl, RECIPE_IMAGE_BUCKET } from "@/lib/recipe-images";
import { syncRecipeTags } from "@/lib/save-recipe";
import { isMissingColumnError, queryKeys, useUserId, type RecipesData } from "@/hooks/use-planner-data";
import type { Recipe } from "@/types/database";

const SHARE_ID_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// 12 characters from 56: far too many combinations to guess a link.
export function createShareId(length = 12) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => SHARE_ID_ALPHABET[byte % SHARE_ID_ALPHABET.length]).join("");
}

export const shareUrl = (shareId: string) => `${window.location.origin}/r/${shareId}`;

export type SharingResult = "ok" | "needs-migration" | "error";

/**
 * Turns a recipe's share link and "Entdecken" listing on or off, and keeps the
 * cached recipe list in step.
 */
export function useUpdateRecipeSharing() {
  const queryClient = useQueryClient();
  const userId = useUserId();

  return async (
    recipe: Recipe,
    patch: Partial<Pick<Recipe, "share_id" | "is_public">>,
  ): Promise<SharingResult> => {
    if (!userId) return "error";

    const { error } = await createClient().from("recipes").update(patch).eq("id", recipe.id).eq("user_id", userId);

    if (isMissingColumnError(error)) return "needs-migration";
    if (error) {
      console.error(error);
      return "error";
    }

    queryClient.setQueryData<RecipesData>(queryKeys.recipes(userId), (data) =>
      data
        ? { ...data, recipes: data.recipes.map((entry) => (entry.id === recipe.id ? { ...entry, ...patch } : entry)) }
        : data,
    );
    return "ok";
  };
}

// A recipe someone else shared: from a share link or from "Entdecken".
export type SharedRecipe = Pick<
  Recipe,
  | "id"
  | "name"
  | "ingredients"
  | "preparation_steps"
  | "source_url"
  | "prep_time"
  | "calories"
  | "protein"
  | "carbs"
  | "fats"
  | "serving_size"
  | "image_url"
> & {
  author_name: string | null;
  tags: string[];
};

const SAVED_STORAGE_KEY = "weekly-meal-planner:saved-shared-recipes";
// Shared recipe id → id of the user's own copy, so planning reuses that copy.
const COPIES_STORAGE_KEY = "weekly-meal-planner:shared-recipe-copies";

export function readSavedSharedIds(): string[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(SAVED_STORAGE_KEY) ?? "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function readCopies(): Record<string, string> {
  try {
    const stored = JSON.parse(window.localStorage.getItem(COPIES_STORAGE_KEY) ?? "{}");
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    return {};
  }
}

function rememberSaved(id: string, copyId: string) {
  try {
    window.localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify([...new Set([...readSavedSharedIds(), id])]));
    window.localStorage.setItem(COPIES_STORAGE_KEY, JSON.stringify({ ...readCopies(), [id]: copyId }));
  } catch {
    // Storage unavailable; the save itself still worked.
  }
}

/**
 * The user's own copy of a shared recipe: the remembered one, else one with the
 * same name and ingredients (saved on another device or before copies were
 * remembered).
 */
export function findOwnCopy(source: SharedRecipe, ownRecipes: Recipe[]): Recipe | null {
  const copyId = readCopies()[source.id];
  return (
    ownRecipes.find((recipe) => recipe.id === copyId) ??
    ownRecipes.find((recipe) => recipe.name === source.name && recipe.ingredients === source.ingredients) ??
    null
  );
}

/**
 * Copies the cover into the user's own folder, so the copy keeps its picture
 * even if the original is deleted. Falls back to the original picture.
 */
async function copyCover(imageUrl: string | null, userId: string) {
  const sourcePath = getRecipeImagePathFromUrl(imageUrl);
  if (!imageUrl || !sourcePath) return imageUrl;

  const supabase = createClient();
  const targetPath = createRecipeImagePath(userId, sourcePath.split("/").pop() ?? "cover.jpg");
  const { error } = await supabase.storage.from(RECIPE_IMAGE_BUCKET).copy(sourcePath, targetPath);
  if (error) return imageUrl;

  return supabase.storage.from(RECIPE_IMAGE_BUCKET).getPublicUrl(targetPath).data.publicUrl;
}

/**
 * Saves a copy of someone else's recipe into the signed-in user's recipes.
 */
export async function saveSharedRecipeCopy(source: SharedRecipe): Promise<Recipe> {
  const user = await getSessionUser();
  if (!user) throw new Error("Nicht angemeldet");

  const { data, error } = await createClient()
    .from("recipes")
    .insert({
      user_id: user.id,
      name: source.name,
      ingredients: source.ingredients,
      preparation_steps: source.preparation_steps,
      source_url: source.source_url,
      prep_time: source.prep_time,
      calories: source.calories,
      protein: source.protein,
      carbs: source.carbs,
      fats: source.fats,
      serving_size: source.serving_size,
      image_url: await copyCover(source.image_url, user.id),
      is_public: false,
    })
    .select("*")
    .single();

  if (error || !data) throw error ?? new Error("Speichern fehlgeschlagen");

  try {
    await syncRecipeTags(data.id, user.id, source.tags);
  } catch (tagError) {
    console.error(tagError);
  }

  rememberSaved(source.id, data.id);
  return data;
}

export function useSaveSharedRecipe() {
  const queryClient = useQueryClient();
  const userId = useUserId();

  return async (source: SharedRecipe) => {
    const saved = await saveSharedRecipeCopy(source);
    await queryClient.invalidateQueries({ queryKey: queryKeys.recipes(userId ?? "") });
    return saved;
  };
}
