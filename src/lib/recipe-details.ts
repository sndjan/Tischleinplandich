// Structured extras the AI collects with a recipe (migration 028): times,
// equipment, tips, allergens, storage, search words, and per ingredient and step
// what the plain text can't say. Some of it is shown now; the rest is collected
// for later features (smarter shopping list, AI week plan, search).

import { z } from "zod/v4";
import type { ShoppingSectionId } from "@/lib/shopping-sections";
import { ingredientLines } from "@/lib/ingredient-lines";

// Bump when the stored shape changes. Older versions are still read (missing
// fields fall back to defaults); the number tells which recipes a newer prompt
// would improve.
export const DETAILS_VERSION = 1;

export const ALLERGENS = [
  "gluten",
  "crustaceans",
  "eggs",
  "fish",
  "peanuts",
  "soy",
  "milk",
  "nuts",
  "celery",
  "mustard",
  "sesame",
  "sulphites",
  "lupin",
  "molluscs",
] as const;
export type Allergen = (typeof ALLERGENS)[number];

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  gluten: "Gluten",
  crustaceans: "Krebstiere",
  eggs: "Eier",
  fish: "Fisch",
  peanuts: "Erdnüsse",
  soy: "Soja",
  milk: "Milch",
  nuts: "Schalenfrüchte",
  celery: "Sellerie",
  mustard: "Senf",
  sesame: "Sesam",
  sulphites: "Sulfite",
  lupin: "Lupinen",
  molluscs: "Weichtiere",
};

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Einfach",
  medium: "Mittel",
  hard: "Aufwendig",
};

export const DETAIL_MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

export const SHOPPING_SECTION_IDS = [
  "produce",
  "bakery",
  "dairy",
  "meat",
  "dry",
  "canned",
  "spices",
  "frozen",
  "drinks",
  "other",
] as const satisfies readonly ShoppingSectionId[];

const MAX_LIST = 15;
const MAX_TEXT = 300;

// Every field falls back on its own, so one odd value never drops the rest.
const text = (max = MAX_TEXT) => z.string().trim().max(max).catch("");
const textList = (max: number) =>
  z
    .array(z.unknown())
    .catch([])
    .transform((items) =>
      items
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, MAX_TEXT))
        .filter(Boolean)
        .slice(0, max),
    );
const enumList = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .array(z.unknown())
    .catch([])
    .transform((items) => [...new Set(items.filter((item): item is T[number] => values.includes(item as string)))]);
const asObject = (value: unknown) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});
const count = (max: number) => z.number().finite().min(0).max(max).nullable().catch(null);
const flag = z.boolean().nullable().catch(null);

const IngredientInfoSchema = z.object({
  // Plain name for merging across recipes: "Tomate (Dose)" for "gehackte Tomaten aus der Dose".
  base_name: text(80),
  section: z.enum(SHOPPING_SECTION_IDS).catch("other"),
  pantry: z.boolean().catch(false),
  perishable: z.boolean().catch(false),
  // For the listed amount (whole recipe), not per portion.
  kcal: count(20_000),
  protein: count(2_000),
  carbs: count(2_000),
  fat: count(2_000),
});

const StepUseSchema = z.object({
  // Index into the recipe's ingredient lines without group headers.
  i: z.number().int().min(0).max(199),
  // Share of the ingredient used in this step; null means all of it.
  fraction: z.number().gt(0).max(1).nullable().catch(null),
});

const StepInfoSchema = z.object({
  uses: z
    .array(z.unknown())
    .catch([])
    .transform((items) =>
      items.flatMap((item) => {
        const parsed = StepUseSchema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      }),
    ),
});

const RecipeDetailsSchema = z.object({
  version: z.number().int().min(0).catch(0),
  // Ingredients and steps the per-line data below was written for.
  fingerprint: z.string().max(16).catch(""),
  description: text(),
  keywords: textList(12),
  active_minutes: count(24 * 60),
  total_minutes: count(7 * 24 * 60),
  time_estimated: z.boolean().catch(false),
  difficulty: z.enum(DIFFICULTIES).nullable().catch(null),
  meal_types: enumList(DETAIL_MEAL_TYPES),
  equipment: textList(MAX_LIST),
  tips: textList(5),
  allergens: enumList(ALLERGENS),
  fridge_days: count(30),
  freezable: flag,
  portable: flag,
  leftovers: flag,
  // Calories and macros were summed from per-ingredient estimates (not the source).
  nutrition_estimated: z.boolean().catch(false),
  // The values failed the plausibility check and should be looked at.
  nutrition_warning: z.boolean().catch(false),
  ingredients: z
    .array(z.unknown())
    .catch([])
    .transform((items) => items.slice(0, 200).map((item) => IngredientInfoSchema.parse(asObject(item)))),
  steps: z
    .array(z.unknown())
    .catch([])
    .transform((items) => items.slice(0, 60).map((item) => StepInfoSchema.parse(asObject(item)))),
});

export type RecipeDetails = z.infer<typeof RecipeDetailsSchema>;
export type IngredientInfo = RecipeDetails["ingredients"][number];
export type StepInfo = RecipeDetails["steps"][number];

/**
 * Stored details, validated. Null when there are none; unknown or broken fields
 * fall back to empty values instead of dropping everything.
 */
export function parseRecipeDetails(value: unknown): RecipeDetails | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const parsed = RecipeDetailsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export const emptyRecipeDetails = (): RecipeDetails => RecipeDetailsSchema.parse({ version: DETAILS_VERSION });

const splitSteps = (steps: string | null | undefined) =>
  (steps ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^\d+[.)](?!\d)\s*/, "").toLowerCase().replace(/\s+/g, " "))
    .filter(Boolean);

/**
 * Short hash of a recipe's ingredient lines (in order) and steps. Per-ingredient
 * and per-step details only apply while it matches, since they refer to lines by
 * position.
 */
export function detailsFingerprint(ingredients: string | null | undefined, steps: string | null | undefined): string {
  const lines = ingredientLines(ingredients).map(({ line }) => line.toLowerCase().replace(/\s+/g, ""));
  const value = `${lines.join("\n")}||${splitSteps(steps).join("\n")}`;

  // FNV-1a, 32 bit, as for the balance facts.
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Whether the per-ingredient and per-step details still describe this recipe.
 */
export function detailsMatch(
  details: RecipeDetails | null,
  recipe: { ingredients: string | null; preparation_steps: string | null },
): details is RecipeDetails {
  return Boolean(details?.fingerprint) && details!.fingerprint === detailsFingerprint(recipe.ingredients, recipe.preparation_steps);
}

export type Nutrition = { calories: number; protein: number; carbs: number; fats: number };

/**
 * Calories and macros per portion, summed from per-ingredient estimates. Null
 * when no ingredient has a calorie estimate.
 */
export function sumIngredientNutrition(ingredients: IngredientInfo[], servings: number): Nutrition | null {
  if (!ingredients.some((ingredient) => ingredient.kcal !== null)) return null;

  const portions = servings > 0 ? servings : 1;
  const total = (key: "kcal" | "protein" | "carbs" | "fat") =>
    ingredients.reduce((sum, ingredient) => sum + (ingredient[key] ?? 0), 0) / portions;

  return {
    calories: Math.round(total("kcal")),
    protein: Math.round(total("protein")),
    carbs: Math.round(total("carbs")),
    fats: Math.round(total("fat")),
  };
}

/**
 * Whether nutrition values per portion look plausible: a realistic calorie range,
 * and calories that roughly match the macros (4 kcal per g protein and carbs,
 * 9 per g fat). Fibre and alcohol explain small gaps, so 25 % is tolerated.
 */
export function isNutritionPlausible(nutrition: Partial<Record<keyof Nutrition, number | null>>): boolean {
  const { calories, protein, carbs, fats } = nutrition;
  if (calories == null || protein == null || carbs == null || fats == null) return true;
  if (calories < 20 || calories > 3000) return false;

  const fromMacros = protein * 4 + carbs * 4 + fats * 9;
  return Math.abs(fromMacros - calories) <= Math.max(calories * 0.25, 40);
}

/**
 * "1 Std. 15 Min." style text for a number of minutes; "ca." marks estimates.
 */
export function formatMinutes(minutes: number, estimated = false): string {
  const rounded = Math.max(1, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  const textValue = hours > 0 ? `${hours} Std.${rest > 0 ? ` ${rest} Min.` : ""}` : `${rest} Min.`;
  return estimated ? `ca. ${textValue}` : textValue;
}

/**
 * A step's share of an ingredient as a cook would say it ("½", "⅓"), or a
 * percentage when there is no common fraction.
 */
export function formatFraction(fraction: number): string {
  const known: Array<[number, string]> = [
    [0.25, "¼"],
    [1 / 3, "⅓"],
    [0.5, "½"],
    [2 / 3, "⅔"],
    [0.75, "¾"],
  ];
  const match = known.find(([value]) => Math.abs(value - fraction) < 0.04);
  return match ? match[1] : `${Math.round(fraction * 100)} %`;
}
