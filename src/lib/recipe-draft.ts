// A recipe extracted by the AI import agent, used to prefill the recipe form.
// Shared between the extraction API route and the client components.

export type RecipeDraft = {
  name: string;
  // One ingredient per line ("200 g Feta").
  ingredients: string;
  preparation_steps: string;
  source_url: string;
  prep_time: string;
  tags: string[];
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  serving_size: number;
};

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
