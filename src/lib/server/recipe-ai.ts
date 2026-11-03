import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DAILY_AI_LIMIT, type RecipeDraft } from "@/lib/recipe-draft";
import {
  BALANCE_GROUPS,
  BALANCE_VERSION,
  balanceFingerprint,
  parseRecipeBalance,
  type RecipeBalance,
} from "@/lib/balance";
import { safeFetch } from "@/lib/server/safe-fetch";
import { formatIngredientHeader } from "@/lib/ingredient-lines";
import {
  ALLERGENS,
  DETAIL_MEAL_TYPES,
  DETAILS_VERSION,
  DIFFICULTIES,
  SHOPPING_SECTION_IDS,
  detailsFingerprint,
  formatMinutes,
  isNutritionPlausible,
  parseRecipeDetails,
  sumIngredientNutrition,
} from "@/lib/recipe-details";

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

// The AI schema has plain types only: the SDK drops min/max constraints from the
// schema and checks them afterwards, so a broken one would fail the whole import.
// Values are clamped by parseRecipeDetails instead.
//
// The API rejects schemas with more than 16 nullable fields (each one is a type
// union) with a 400, so numbers the model can always give are plain numbers
// with 0 for "none". The limit is checked in recipe-ai.test.ts.
const IngredientSchema = z.object({
  // Short id ("z1") the steps refer to.
  id: z.string(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  name: z.string(),
  base_name: z.string(),
  section: z.enum(SHOPPING_SECTION_IDS),
  pantry: z.boolean(),
  perishable: z.boolean(),
  // For the listed amount (whole recipe); the app sums them per portion.
  kcal: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
});

// Facts for the "Ausgewogenheit" score. The app calculates the score from them
// (src/lib/balance.ts); the model never rates a recipe itself.
export const BalanceFactsSchema = z.object({
  energy_kcal: z.number(),
  fiber_g: z.number(),
  added_sugar_g: z.number(),
  saturated_fat_g: z.number(),
  salt_g: z.number(),
  ingredients: z.array(
    z.object({
      name: z.string(),
      grams: z.number(),
      group: z.enum(BALANCE_GROUPS),
      nova: z.number(),
      whole_grain: z.boolean(),
      plant: z.string().nullable(),
    }),
  ),
});

// Field order matters: the result streams in this order, which drives the
// progress steps shown while it is written.
const RecipeFields = {
  name: z.string(),
  description: z.string(),
  serving_size: z.number(),
  active_minutes: z.number(),
  total_minutes: z.number(),
  time_from_source: z.boolean(),
  difficulty: z.enum(DIFFICULTIES),
  ingredient_groups: z.array(
    z.object({
      title: z.string().nullable(),
      ingredients: z.array(IngredientSchema),
    }),
  ),
  steps: z.array(
    z.object({
      text: z.string(),
      uses: z.array(z.object({ ingredient_id: z.string(), fraction: z.number().nullable() })),
    }),
  ),
  nutrition_from_source: z.boolean(),
  // 0 unless nutrition_from_source.
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fats: z.number(),
  balance: BalanceFactsSchema,
  equipment: z.array(z.string()),
  tips: z.array(z.string()),
  allergens: z.array(z.enum(ALLERGENS)),
  meal_types: z.array(z.enum(DETAIL_MEAL_TYPES)),
  fridge_days: z.number().nullable(),
  freezable: z.boolean(),
  portable: z.boolean(),
  leftovers: z.boolean(),
  keywords: z.array(z.string()),
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

const BALANCE_RULES = `- balance: sachliche Schätzung PRO PORTION für eine Ernährungsauswertung (du bewertest nichts selbst):
  - energy_kcal (wie die Kalorien pro Portion), fiber_g (Ballaststoffe), added_sugar_g (nur zugesetzter Zucker inkl. Honig und Sirup, nicht der natürliche Zucker in Obst oder Milch), saturated_fat_g, salt_g (Salz inkl. Salz in Brühe, Sojasoße, Käse, Wurst).
  - ingredients: jede Zutat mit grams (geschätztes Gewicht pro Portion), group, nova, whole_grain, plant.
  - group: vegetables (Gemüse, Pilze, Kräuter), fruit, legumes (Hülsenfrüchte inkl. Tofu, Tempeh), potatoes, grains (Getreide, Mehl, Nudeln, Reis, Brot), nuts_seeds, dairy (Milchprodukte, Käse), eggs, fish (Fisch, Meeresfrüchte), poultry, red_meat (Rind, Schwein, Lamm, Hack), processed_meat (Wurst, Schinken, Speck, Salami), fats_oils, sugar_sweets, condiments (Soßen, Brühe, Gewürze, Senf), beverages, other.
  - nova: 1 unverarbeitet oder minimal verarbeitet (frisches Gemüse, Obst, Fleisch, Eier, Milch, Mehl, Reis, Nudeln, getrocknete Hülsenfrüchte), 2 Küchenzutat (Öl, Butter, Zucker, Salz, Essig), 3 verarbeitet (Käse, Brot, Dosengemüse, geräucherter Fisch, Speck), 4 hochverarbeitet (Fertigsoßen, Instantbrühe, Wurst mit Zusatzstoffen, Fleischersatz-Fertigprodukte, Süßigkeiten, Toastbrot).
  - whole_grain: true nur bei Vollkorn (Vollkornmehl, -nudeln, Naturreis, Haferflocken).
  - plant: die Pflanze in einem Wort im Singular ("Tomate", "Kichererbse", "Weizen"), null bei tierischen Zutaten, Salz, Wasser und Zucker.`;

const SHARED_RULES = `Allgemein:
- Schreibe alles auf Deutsch, Schritte in der Du-Form.
- Mengen metrisch (g, kg, ml, l). Übliche Küchenmaße wie EL, TL, Prise, Stück, Bund, Dose bleiben erhalten. Ohne Mengenangabe ist quantity null.
- serving_size: Anzahl der Portionen, die das Rezept ergibt (Standard 1).

Zutaten:
- ingredient_groups: Gruppen wie "Für den Teig" oder "Für die Soße", wenn das Gericht aus mehreren Teilen besteht; sonst genau eine Gruppe mit title null.
- Innerhalb einer Gruppe steht jede Zutat nur einmal; wird sie dort mehrfach gebraucht, addiere die Mengen. In verschiedenen Gruppen darf sie wieder vorkommen.
- id: kurze eindeutige Kennung je Zutat (z1, z2, …) für den Bezug aus den Schritten.
- name: die Zutat ohne Menge, ein Zubereitungshinweis kurz dahinter ("Zwiebel, fein gewürfelt").
- base_name: schlichter Name im Singular zum Zusammenfassen auf der Einkaufsliste ("Zwiebel", "Tomate (Dose)", "Gemüsebrühe").
- section: Abteilung im Supermarkt. pantry: typische Vorratszutat (Salz, Pfeffer, Öl, Essig, Mehl, Zucker, Gewürze). perishable: verdirbt in wenigen Tagen (frischer Fisch, Hackfleisch, frische Kräuter, Blattsalat, Beeren).
- kcal, protein_g, carbs_g, fat_g: Nährwerte für die angegebene Menge der Zutat im ganzen Rezept (nicht pro Portion), nach üblichen Nährwerttabellen. Bei Angaben wie "1 Zwiebel" nimm ein übliches Gewicht an. Salz, Wasser und Gewürze in kleinen Mengen: 0.

Zubereitung:
- Ein Schritt ist ein Arbeitsabschnitt. Handgriffe, die direkt zusammengehören, stehen in einem Schritt ("Nudeln in reichlich Salzwasser 10 Min. bissfest kochen", nicht "Wasser aufsetzen" und "Nudeln kochen" einzeln). Meist 4–8 Schritte, ohne Nummerierung.
- Nenne Hitzestufe und Dauer im Text, Zeiten immer als Zahl mit "Min." oder "Std." ("5 Min.").
- uses: die Zutaten, die in diesem Schritt verarbeitet werden, per ingredient_id. fraction: Anteil der Zutat in diesem Schritt (z. B. 0.5), wenn sie auf mehrere Schritte verteilt wird, sonst null. Sag dann auch im Text, wie viel ("die Hälfte des Knoblauchs").
- Jede Zutat, die ein Schritt braucht, steht in der Zutatenliste.

Zeit:
- active_minutes: aktive Arbeitszeit; total_minutes: Gesamtzeit inklusive Garen, Backen und Ruhen. Aus der Quelle übernehmen (time_from_source true), sonst realistisch aus den Schritten schätzen (time_from_source false). Nicht leer lassen.

Nährwerte:
- nutrition_from_source: true nur, wenn die Quelle Nährwerte nennt. Dann calories (kcal), protein, carbs, fats PRO PORTION aus der Quelle (ggf. auf eine Portion umgerechnet). Sonst false und diese vier Felder 0; die App rechnet sie aus den Zutaten aus.
${BALANCE_RULES}

Weitere Angaben:
- description: ein kurzer Satz, was für ein Gericht das ist.
- difficulty: easy, medium oder hard.
- equipment: alle benötigten Küchengeräte, auch wenn die Quelle keine nennt, abgeleitet aus den Schritten ("Großer Topf", "Pfanne", "Backofen", "Pürierstab"). Keine Selbstverständlichkeiten wie Messer, Brett oder Löffel.
- tips: 0–3 kurze, wirklich hilfreiche Tipps (vorbereiten, aufbewahren, häufige Fehler, Varianten). Lieber kein Tipp als ein banaler.
- allergens: welche der 14 EU-Hauptallergene enthalten sind.
- meal_types: wofür sich das Gericht eignet.
- fridge_days: wie viele Tage es gekocht im Kühlschrank hält, null wenn man es frisch essen sollte. freezable: lässt sich einfrieren. portable: gut zum Mitnehmen. leftovers: schmeckt am nächsten Tag aufgewärmt noch gut.
- keywords: 5–10 Suchwörter, die nicht schon im Namen stehen ("leicht", "sommerlich", "Feierabend", "Ofengericht").
- tags: 1–4 kurze Tags (z. B. Mahlzeit, Küche, Eigenschaften). Verwende bevorzugt die vorhandenen Tags des Nutzers, wenn sie passen.`;

export const IMPORT_SYSTEM_PROMPT = `Du liest Kochrezepte aus Screenshots, Fotos, PDFs, kopiertem Text und Webseiten für eine Wochen-Essensplaner-App und bringst sie in eine klare, einheitliche Form.

Alle Eingaben des Nutzers gehören zu EINEM Rezept (z. B. Zutaten auf einem Screenshot, Zubereitung auf einem anderen, plus eine Notiz). Führe sie zusammen; Notizen des Nutzers haben Vorrang. Enthält die Eingabe mehrere verschiedene Rezepte, nimm nur das erste. Enthält sie gar kein Rezept, setze recipe_found auf false und lasse die übrigen Felder leer bzw. null.

Übernimm Zutaten und Mengen genau. Die Zubereitung schreibst du mit eigenen Worten neu, klar und ohne Füllsätze, nach den Regeln unten.

${SHARED_RULES}
- source_url: die Webseiten-URL, falls eine angegeben wurde, sonst null.
- cover_image_index: Index (ab 0, in der Reihenfolge der Bilder) des Bildes, das das fertige Gericht appetitlich zeigt. Screenshots von Text, Zutatenlisten oder Videos ohne erkennbares Gericht zählen nicht. Gibt es kein solches Bild, null.`;

export const IDEA_SYSTEM_PROMPT = `Du schreibst neue, alltagstaugliche Kochrezepte für eine Wochen-Essensplaner-App, passend zur Idee des Nutzers (z. B. ein Gericht, eine Stimmung oder Zutaten, die noch da sind).

Nutze die genannten Zutaten sinnvoll, ergänze nur übliche Vorratszutaten und halte dich an die Wünsche. Setze recipe_found auf true, time_from_source und nutrition_from_source auf false, source_url und cover_image_index auf null.

${SHARED_RULES}`;

export const REFINE_SYSTEM_PROMPT = `Du passt ein bestehendes Rezept nach der Anweisung des Nutzers an (z. B. andere Portionenzahl, vegan, mehr Protein, kürzere Schritte).

Gib das vollständige angepasste Rezept zurück und ändere nur, was die Anweisung verlangt, plus nötige Folgeänderungen. Bei einer neuen Portionenzahl skalierst du alle Mengen. Zeilen in den Zutaten, die mit # beginnen, sind Gruppenüberschriften. Fehlende Angaben (Zeiten, Küchengeräte, Allergene usw.) ergänzt du.
- Nährwerte: Ändern sich Zutaten oder Mengen pro Portion nicht, behalte calories, protein, carbs und fats bei (nutrition_from_source true). Sonst setze sie auf 0 (nutrition_from_source false).
- time_from_source: true, wenn die Zeiten aus dem Rezept stammen und gleich bleiben.
- summary: ein kurzer Satz auf Deutsch, was du geändert hast.
- changes: die bis zu 6 wichtigsten Änderungen als kurze Texte, z. B. before "200 g Orzo", after "400 g Orzo". Neue Dinge haben before null.

${SHARED_RULES}`;

export const RecalculatedRecipeSchema = z.object(RecipeFields);

export const RECALCULATE_SYSTEM_PROMPT = `Du wertest ein Rezept neu aus, das der Nutzer selbst bearbeitet hat.

Der Text gehört dem Nutzer: Übernimm Name, Portionen, Zutaten (Reihenfolge, Gruppen, Mengen und Wortlaut) und die Zubereitungsschritte (Reihenfolge und Wortlaut) unverändert, auch wenn sie nicht den Regeln unten entsprechen. Zeilen in den Zutaten, die mit # beginnen, sind Gruppenüberschriften; jede andere Zeile ist genau eine Zutat, und jede Zeile der Zubereitung ist genau ein Schritt.

Neu bestimmst du nur die Auswertung: Nährwerte je Zutat, balance, Zeiten, Schwierigkeit, Küchengeräte, Tipps, Allergene und die übrigen Angaben. Vorhandene Küchengeräte und Tipps behältst du und ergänzt nur, was fehlt.
- nutrition_from_source false und calories, protein, carbs, fats 0; die App rechnet sie aus den Zutaten aus.
- time_from_source false.

Regeln für die Auswertung:
${SHARED_RULES}`;

const roundOrNull = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value) ? null : Math.round(value);

const formatQuantity = (quantity: number | null | undefined) =>
  quantity === null || quantity === undefined || !Number.isFinite(quantity)
    ? ""
    : String(Math.round(quantity * 100) / 100).replace(".", ",");

type RecipeLike = Partial<z.infer<z.ZodObject<typeof RecipeFields>>>;
type AiIngredient = Partial<z.infer<typeof IngredientSchema>>;

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asArray = <T>(value: unknown): Partial<T>[] =>
  Array.isArray(value) ? value.filter(isObject).map((item) => item as Partial<T>) : [];

const strings = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];

const formatIngredient = (ingredient: AiIngredient) =>
  [formatQuantity(ingredient.quantity), ingredient.unit?.trim() ?? "", ingredient.name?.trim() ?? ""]
    .filter(Boolean)
    .join(" ");

/**
 * The ingredient groups as text lines ("# Für die Soße" before each named group,
 * unless there is only one), plus the ingredients in the same order.
 */
function flattenIngredients(groups: RecipeLike["ingredient_groups"]) {
  const usable = asArray<{ title: string | null; ingredients: AiIngredient[] }>(groups)
    .map((group) => ({
      title: typeof group.title === "string" ? group.title.trim() : "",
      ingredients: asArray<AiIngredient>(group.ingredients).filter(
        (ingredient) => typeof ingredient.name === "string" && ingredient.name.trim(),
      ),
    }))
    .filter((group) => group.ingredients.length > 0);
  const withHeaders = usable.length > 1;

  const lines: string[] = [];
  const ingredients: AiIngredient[] = [];
  for (const group of usable) {
    if (withHeaders && group.title) lines.push(formatIngredientHeader(group.title));
    for (const ingredient of group.ingredients) {
      lines.push(formatIngredient(ingredient));
      ingredients.push(ingredient);
    }
  }
  return { text: lines.join("\n"), ingredients };
}

/**
 * The facts for the balance score, stamped with the ingredients they were
 * estimated for, so the app notices when the recipe is edited afterwards. Null
 * while still streaming.
 */
export function toRecipeBalance(
  facts: unknown,
  ingredients: string,
  servingSize: number,
): RecipeBalance | null {
  if (!facts || typeof facts !== "object") return null;
  return parseRecipeBalance({
    ...facts,
    version: BALANCE_VERSION,
    fingerprint: balanceFingerprint(ingredients, servingSize),
  });
}

/**
 * Turns the (possibly still incomplete) model output into a draft for the client.
 * Calories and macros come from the source when it has them, otherwise they are
 * the sum of the per-ingredient estimates.
 */
export function toRecipeDraft(recipe: RecipeLike, requestUrl = "", sourceText: string | null = null): RecipeDraft {
  const servingSize =
    typeof recipe.serving_size === "number" && recipe.serving_size > 0 ? recipe.serving_size : 1;
  const { text: ingredients, ingredients: aiIngredients } = flattenIngredients(recipe.ingredient_groups);

  const idToIndex = new Map<string, number>();
  aiIngredients.forEach((ingredient, index) => {
    if (typeof ingredient.id === "string" && !idToIndex.has(ingredient.id)) idToIndex.set(ingredient.id, index);
  });

  const stepEntries = asArray<{ text: string; uses: Array<{ ingredient_id: string; fraction: number | null }> }>(
    recipe.steps,
  )
    .map((step) => ({ text: typeof step.text === "string" ? step.text.trim() : "", uses: step.uses }))
    .filter((step) => step.text);
  const preparationSteps = stepEntries.map((step) => step.text).join("\n");

  const ingredientInfos = aiIngredients.map((ingredient) => ({
    base_name: ingredient.base_name,
    section: ingredient.section,
    pantry: ingredient.pantry,
    perishable: ingredient.perishable,
    kcal: ingredient.kcal,
    protein: ingredient.protein_g,
    carbs: ingredient.carbs_g,
    fat: ingredient.fat_g,
  }));

  const details = parseRecipeDetails({
    version: DETAILS_VERSION,
    fingerprint: detailsFingerprint(ingredients, preparationSteps),
    description: recipe.description,
    keywords: recipe.keywords,
    // 0 means the model had no estimate.
    active_minutes: recipe.active_minutes || null,
    total_minutes: recipe.total_minutes || null,
    time_estimated: recipe.time_from_source !== true,
    difficulty: recipe.difficulty,
    meal_types: recipe.meal_types,
    equipment: recipe.equipment,
    tips: recipe.tips,
    allergens: recipe.allergens,
    fridge_days: recipe.fridge_days,
    freezable: recipe.freezable,
    portable: recipe.portable,
    leftovers: recipe.leftovers,
    ingredients: ingredientInfos,
    steps: stepEntries.map((step) => ({
      uses: asArray<{ ingredient_id: string; fraction: number | null }>(step.uses).flatMap((use) => {
        const index = typeof use.ingredient_id === "string" ? idToIndex.get(use.ingredient_id) : undefined;
        if (index === undefined) return [];
        const fraction = typeof use.fraction === "number" && use.fraction > 0 && use.fraction < 0.99 ? use.fraction : null;
        return [{ i: index, fraction }];
      }),
    })),
  });

  // Values from the source win; otherwise the per-ingredient estimates are summed.
  const fromSource =
    recipe.nutrition_from_source === true && typeof recipe.calories === "number" && recipe.calories > 0;
  const summed = details ? sumIngredientNutrition(details.ingredients, servingSize) : null;
  const nutrition = fromSource
    ? {
        calories: roundOrNull(recipe.calories),
        protein: roundOrNull(recipe.protein),
        carbs: roundOrNull(recipe.carbs),
        fats: roundOrNull(recipe.fats),
      }
    : {
        calories: summed?.calories ?? null,
        protein: summed?.protein ?? null,
        carbs: summed?.carbs ?? null,
        fats: summed?.fats ?? null,
      };

  if (details) {
    details.nutrition_estimated = !fromSource && summed !== null;
    details.nutrition_warning = nutrition.calories !== null && !isNutritionPlausible(nutrition);
  }

  const totalMinutes = details?.total_minutes ?? null;

  return {
    name: typeof recipe.name === "string" ? recipe.name.trim() : "",
    ingredients,
    preparation_steps: preparationSteps,
    source_url: recipe.source_url?.trim() || requestUrl,
    prep_time: totalMinutes ? formatMinutes(totalMinutes, details?.time_estimated ?? false) : "",
    tags: strings(recipe.tags),
    ...nutrition,
    serving_size: servingSize,
    balance: toRecipeBalance(recipe.balance, ingredients, servingSize),
    details,
    source_text: sourceText,
  };
}

/**
 * A recipe draft as the AI reads it for changes: ingredient lines with group
 * headers, steps, and the extras worth keeping.
 */
export function draftForRefine(draft: RecipeDraft) {
  const details = parseRecipeDetails(draft.details);
  return {
    name: draft.name,
    serving_size: draft.serving_size,
    prep_time: draft.prep_time,
    ingredients: draft.ingredients.split("\n").filter(Boolean),
    preparation_steps: draft.preparation_steps.split("\n").filter(Boolean),
    calories: draft.calories,
    protein: draft.protein,
    carbs: draft.carbs,
    fats: draft.fats,
    tags: draft.tags,
    ...(details && {
      equipment: details.equipment,
      tips: details.tips,
      active_minutes: details.active_minutes,
      total_minutes: details.total_minutes,
    }),
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
