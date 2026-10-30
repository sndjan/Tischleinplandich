// A recipe produced by the AI (import, idea or a chat change), used to prefill the
// recipe editor. Shared between the API routes and the client components.

import type { RecipeBalance } from "@/lib/balance";

export type RecipeDraft = {
  name: string;
  // One ingredient per line ("200 g Feta").
  ingredients: string;
  // One step per line.
  preparation_steps: string;
  source_url: string;
  prep_time: string;
  tags: string[];
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  serving_size: number;
  // Facts for the "Ausgewogenheit" score, estimated along with the recipe.
  balance: RecipeBalance | null;
};

export type RecipeStreamStage = "reading" | "ingredients" | "steps" | "nutrition";

// Newline-delimited JSON events sent by /api/recipes/extract.
export type RecipeStreamEvent =
  | { type: "step"; id: string; status: "active" | "done"; label: string }
  | { type: "partial"; stage: RecipeStreamStage; draft: RecipeDraft }
  | {
      type: "done";
      draft: RecipeDraft;
      coverImageIndex: number | null;
      // Photo from the imported web page, base64, when no attached image fits.
      coverImage?: { mediaType: string; data: string } | null;
    }
  | { type: "error"; message: string };

export type RecipeRefineResult = {
  draft: RecipeDraft;
  summary: string;
  changes: Array<{ before: string | null; after: string }>;
};

// AI requests (import, "Aus Idee", chat changes, "Ausgewogenheit berechnen") per user and day.
export const DAILY_AI_LIMIT = 30;

export const RECIPE_EXTRACT_MAX_IMAGES = 5;
export const RECIPE_EXTRACT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
// Kept below common serverless request body limits (e.g. 4.5 MB on Vercel).
export const RECIPE_EXTRACT_MAX_PDF_BYTES = 4 * 1024 * 1024;
export const RECIPE_EXTRACT_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;
