import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DAILY_AI_LIMIT, type RecipeDraft } from "@/lib/recipe-draft";
import { safeFetch } from "@/lib/server/safe-fetch";

// Haiku is plenty for reading and adapting recipes and keeps each request at a
// fraction of a cent. Low effort keeps the hidden reasoning (and its cost) short.
export const RECIPE_AI_MODEL = "claude-haiku-5-5";
export const RECIPE_AI_EFFORT = "low" as const;

// Above ~100k input tokens Haiku costs 5x; this keeps PDFs well below that.
export const MAX_PDF_PAGES = 20;

export const anthropic = new Anthropic();

export class UserFacingError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const IngredientSchema = z.object({
  name: z.string(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
});

// Field order matters: the result streams in this order, which drives the
// progress steps shown while it is written.
const RecipeFields = {
  name: z.string(),
  prep_time: z.string().nullable(),
  serving_size: z.number(),
  ingredients: z.array(IngredientSchema),
  preparation_steps: z.array(z.string()),
  calories: z.number().nullable(),
  protein: z.number().nullable(),
  carbs: z.number().nullable(),
  fats: z.number().nullable(),
  tags: z.array(z.string()),
  source_url: z.string().nullable(),
};

export const ExtractedRecipeSchema = z.object({
  recipe_found: z.boolean(),
  ...RecipeFields,
  // Which attached image (0-based) shows the finished dish, for the cover photo.
  cover_image_index: z.number().nullable(),
});

export const RefinedRecipeSchema = z.object({
  recipe: z.object(RecipeFields),
  summary: z.string(),
  changes: z.array(z.object({ before: z.string().nullable(), after: z.string() })),
});

export type ExtractedRecipe = z.infer<typeof ExtractedRecipeSchema>;

const SHARED_RULES = `Regeln:
- Schreibe Name, Zutaten, Zubereitungsschritte und Tags auf Deutsch.
- Mengen metrisch (g, kg, ml, l). Übliche Küchenmaße wie EL, TL, Prise, Stück, Bund, Dose bleiben erhalten. Ohne Mengenangabe ist quantity null.
- preparation_steps: ein Schritt pro Eintrag, ohne Nummerierung.
- serving_size: Anzahl der Portionen, die das Rezept ergibt (Standard 1).
- Nährwerte (calories in kcal, protein/carbs/fats in g) gelten PRO PORTION. Stehen sie in der Quelle, übernimm sie (ggf. auf eine Portion umgerechnet). Fehlen sie, schätze sie realistisch anhand der Zutaten und Mengen.
- prep_time als kurzer Text, z. B. "30 Min." oder null.
- tags: 1–4 kurze Tags (z. B. Mahlzeit, Küche, Eigenschaften). Verwende bevorzugt die vorhandenen Tags des Nutzers, wenn sie passen.`;

export const IMPORT_SYSTEM_PROMPT = `Du extrahierst Kochrezepte aus Screenshots, Fotos, PDFs, kopiertem Text und Webseiten für eine Wochen-Essensplaner-App.

Alle Eingaben des Nutzers gehören zu EINEM Rezept (z. B. Zutaten auf einem Screenshot, Zubereitung auf einem anderen, plus eine Notiz). Führe sie zusammen; Notizen des Nutzers haben Vorrang. Enthält die Eingabe mehrere verschiedene Rezepte, nimm nur das erste. Enthält sie gar kein Rezept, setze recipe_found auf false und lasse die übrigen Felder leer bzw. null.

${SHARED_RULES}
- source_url: die Webseiten-URL, falls eine angegeben wurde, sonst null.
- cover_image_index: Index (ab 0, in der Reihenfolge der Bilder) des Bildes, das das fertige Gericht appetitlich zeigt. Screenshots von Text, Zutatenlisten oder Videos ohne erkennbares Gericht zählen nicht. Gibt es kein solches Bild, null.`;

export const IDEA_SYSTEM_PROMPT = `Du schreibst neue, alltagstaugliche Kochrezepte für eine Wochen-Essensplaner-App, passend zur Idee des Nutzers (z. B. ein Gericht, eine Stimmung oder Zutaten, die noch da sind).

Nutze die genannten Zutaten sinnvoll, ergänze nur übliche Vorratszutaten und halte dich an die Wünsche. Schreibe klare, kurze Schritte. Setze recipe_found auf true, source_url und cover_image_index auf null.

${SHARED_RULES}`;

export const REFINE_SYSTEM_PROMPT = `Du passt ein bestehendes Rezept nach der Anweisung des Nutzers an (z. B. andere Portionenzahl, vegan, mehr Protein, kürzere Schritte).

Gib das vollständige angepasste Rezept zurück und ändere nur, was die Anweisung verlangt (plus nötige Folgeänderungen wie Nährwerte oder Tags). Bei einer neuen Portionenzahl skalierst du alle Mengen; die Nährwerte bleiben pro Portion.
- summary: ein kurzer Satz auf Deutsch, was du geändert hast.
- changes: die bis zu 6 wichtigsten Änderungen als kurze Texte, z. B. before "200 g Orzo", after "400 g Orzo". Neue Dinge haben before null.

${SHARED_RULES}`;

const roundOrNull = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value) ? null : Math.round(value);

const formatQuantity = (quantity: number | null | undefined) =>
  quantity === null || quantity === undefined || !Number.isFinite(quantity)
    ? ""
    : String(Math.round(quantity * 100) / 100).replace(".", ",");

type RecipeLike = Partial<z.infer<z.ZodObject<typeof RecipeFields>>>;

/**
 * Turns the (possibly still incomplete) model output into a draft for the client.
 */
export function toRecipeDraft(recipe: RecipeLike, requestUrl = ""): RecipeDraft {
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const steps = Array.isArray(recipe.preparation_steps) ? recipe.preparation_steps : [];

  return {
    name: typeof recipe.name === "string" ? recipe.name.trim() : "",
    ingredients: ingredients
      .filter((ingredient) => ingredient && typeof ingredient.name === "string")
      .map((ingredient) =>
        [formatQuantity(ingredient.quantity), ingredient.unit?.trim() ?? "", ingredient.name.trim()]
          .filter(Boolean)
          .join(" "),
      )
      .filter(Boolean)
      .join("\n"),
    preparation_steps: steps
      .filter((step): step is string => typeof step === "string")
      .map((step) => step.trim())
      .filter(Boolean)
      .join("\n"),
    source_url: recipe.source_url?.trim() || requestUrl,
    prep_time: recipe.prep_time?.trim() ?? "",
    tags: (Array.isArray(recipe.tags) ? recipe.tags : [])
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim())
      .filter(Boolean),
    calories: roundOrNull(recipe.calories),
    protein: roundOrNull(recipe.protein),
    carbs: roundOrNull(recipe.carbs),
    fats: roundOrNull(recipe.fats),
    serving_size:
      typeof recipe.serving_size === "number" && recipe.serving_size > 0 ? recipe.serving_size : 1,
  };
}

/**
 * Counts one AI request against the user's daily limit.
 */
export async function consumeAiQuota(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("consume_ai_quota", { daily_limit: DAILY_AI_LIMIT });

  if (error) {
    // Until the ai_usage migration is applied the limit is simply not enforced.
    console.warn("AI quota check unavailable", error.message);
    return;
  }

  if (data === false) {
    throw new UserFacingError(
      `Tageslimit erreicht (${DAILY_AI_LIMIT} KI-Anfragen). Morgen geht es weiter.`,
      429,
    );
  }
}

/**
 * Rough page count of a PDF. Pages hidden in compressed object streams are not
 * counted, so this only catches obviously long files.
 */
export function countPdfPages(bytes: Buffer): number {
  return bytes.toString("latin1").match(/\/Type\s*\/Page(?![a-zA-Z])/g)?.length ?? 0;
}

export async function getUserTagNames(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("tags")
    .select("name")
    .eq("user_id", userId)
    .order("name");

  if (error) throw error;
  return ((data ?? []) as Array<{ name: string }>).map((tag) => tag.name);
}

export function toErrorResponseBody(error: unknown): { status: number; message: string } {
  if (error instanceof UserFacingError) {
    return { status: error.status, message: error.message };
  }

  console.error("Recipe AI request failed", error);

  if (error instanceof Anthropic.RateLimitError) {
    return { status: 429, message: "Zu viele Anfragen, bitte kurz warten" };
  }

  if (error instanceof Anthropic.AuthenticationError) {
    return {
      status: 500,
      message: "Claude-API-Schlüssel fehlt oder ist ungültig (ANTHROPIC_API_KEY)",
    };
  }

  return { status: 500, message: "Das hat nicht geklappt, bitte erneut versuchen" };
}

export type RecipePage = {
  content: string;
  // The page's own photo of the dish, used as cover when none was attached.
  imageUrl: string | null;
};

// Covers travel back inside the streamed response, so they stay small.
const MAX_COVER_BYTES = 3 * 1024 * 1024;
const COVER_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function fetchRecipePage(rawUrl: string): Promise<RecipePage> {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new UserFacingError("Ungültige URL", 400);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UserFacingError("Nur http- und https-Links", 400);
  }

  let html: string;

  try {
    const { response, body } = await safeFetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Tischleinplandich/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10_000),
      maxBytes: 3 * 1024 * 1024,
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    html = body.toString("utf8");
  } catch (error) {
    console.error("Recipe page fetch failed", error);
    throw new UserFacingError("Webseite nicht erreichbar – nutze Text oder Screenshot", 422);
  }

  // Most recipe sites embed a schema.org Recipe as JSON-LD, which is far
  // cleaner (and cheaper) than the page text.
  const jsonLdBlocks = Array.from(
    html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
    (match) => match[1].trim(),
  ).filter((block) => /"@type"\s*:\s*(\[[^\]]*)?"Recipe"/.test(block));

  const imageUrl = findPageImage(html, jsonLdBlocks, url);

  if (jsonLdBlocks.length > 0) {
    return { content: jsonLdBlocks.join("\n"), imageUrl };
  }

  const pageText = html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|li|h\d|div|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();

  if (!pageText) {
    throw new UserFacingError("Kein Text auf der Webseite", 422);
  }

  // Page text beyond this is almost always comments, footers and ads.
  return { content: pageText.slice(0, 60_000), imageUrl };
}

/**
 * The dish photo of a recipe page: the schema.org Recipe image, else og:image.
 */
function findPageImage(html: string, jsonLdBlocks: string[], pageUrl: URL): string | null {
  const candidates: unknown[] = [];

  for (const block of jsonLdBlocks) {
    try {
      collectRecipeImages(JSON.parse(block), candidates);
    } catch {
      // Broken JSON-LD is common; og:image below still works.
    }
  }

  const ogImage =
    html.match(/<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["']/i)?.[1];
  if (ogImage) candidates.push(ogImage);

  for (const candidate of candidates) {
    const raw =
      typeof candidate === "string"
        ? candidate
        : candidate && typeof candidate === "object" && "url" in candidate
          ? String((candidate as { url: unknown }).url)
          : null;
    if (!raw) continue;

    try {
      const resolved = new URL(raw.replace(/&amp;/g, "&").trim(), pageUrl);
      if (resolved.protocol === "http:" || resolved.protocol === "https:") return resolved.href;
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

function collectRecipeImages(node: unknown, out: unknown[]) {
  if (Array.isArray(node)) {
    node.forEach((item) => collectRecipeImages(item, out));
    return;
  }
  if (!node || typeof node !== "object") return;

  const record = node as Record<string, unknown>;
  const type = record["@type"];
  const isRecipe = type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"));

  if (isRecipe && record.image) {
    out.push(...(Array.isArray(record.image) ? record.image : [record.image]));
  }
  if (record["@graph"]) collectRecipeImages(record["@graph"], out);
}

/**
 * Downloads a page's dish photo for the cover. Missing or odd images just mean
 * no cover, never a failed import.
 */
export async function fetchCoverImage(
  imageUrl: string,
): Promise<{ mediaType: string; data: string } | null> {
  try {
    const { response, body: bytes } = await safeFetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Tischleinplandich/1.0)", Accept: "image/*" },
      signal: AbortSignal.timeout(8_000),
      maxBytes: MAX_COVER_BYTES,
    });
    if (!response.ok) return null;

    const mediaType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!COVER_TYPES.includes(mediaType)) return null;
    if (bytes.length === 0) return null;

    return { mediaType, data: bytes.toString("base64") };
  } catch (error) {
    console.warn("Cover image fetch failed", error);
    return null;
  }
}
