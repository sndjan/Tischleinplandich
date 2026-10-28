import { getRecipeImagePathFromUrl } from "@/lib/recipe-images";

// Recipes can be written straight through the Supabase API, and shared ones are
// shown to other people, so links and images from the database are checked
// before they reach an href or src.

/**
 * The URL when it is a plain http(s) link, else null. Blocks javascript: and
 * data: links, which would run code in the reader's session when clicked.
 */
export function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

/**
 * A source link typed by the user: "chefkoch.de/…" becomes "https://chefkoch.de/…",
 * anything that isn't an http(s) link is dropped.
 */
export function toSourceUrl(input: string | null | undefined): string | null {
  const text = input?.trim();
  if (!text) return null;
  return safeHttpUrl(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
}

/**
 * Whether an image URL points into our own recipe-images bucket. Anything else
 * would let a shared recipe load pictures (and readers' IP addresses) from
 * someone else's server.
 */
export function isOwnRecipeImage(url: string | null | undefined): url is string {
  if (!url || !getRecipeImagePathFromUrl(url)) return false;
  try {
    return (
      new URL(url).protocol === "https:" &&
      new URL(url).host === new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host
    );
  } catch {
    return false;
  }
}

/**
 * The recipe with its source link and cover image cleared when they fail the
 * checks above. Applied wherever recipes are loaded.
 */
export function withSafeLinks<T extends { image_url: string | null; source_url: string | null }>(recipe: T): T {
  return {
    ...recipe,
    image_url: isOwnRecipeImage(recipe.image_url) ? recipe.image_url : null,
    source_url: safeHttpUrl(recipe.source_url),
  };
}
