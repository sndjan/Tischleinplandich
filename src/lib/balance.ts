// "Ausgewogenheit": a 0–100 score per recipe and per week. The AI only estimates
// facts (what is in a portion, how processed it is); the points come from the
// fixed rules below, so the same recipe always gets the same score and every
// point can be explained. The public explanation lives at /ausgewogenheit and
// must be updated together with these rules.

import { z } from "zod/v4";

// Bump when the stored facts change shape; scoring changes need no bump because
// the score is never stored.
export const BALANCE_VERSION = 1;

export const BALANCE_GROUPS = [
  "vegetables",
  "fruit",
  "legumes",
  "potatoes",
  "grains",
  "nuts_seeds",
  "dairy",
  "eggs",
  "fish",
  "poultry",
  "red_meat",
  "processed_meat",
  "fats_oils",
  "sugar_sweets",
  "condiments",
  "beverages",
  "other",
] as const;

export type BalanceGroup = (typeof BALANCE_GROUPS)[number];

export type BalanceIngredient = {
  name: string;
  // Per portion.
  grams: number;
  group: BalanceGroup;
  // NOVA class: 1 unprocessed, 2 culinary ingredient (oil, salt, sugar), 3 processed, 4 ultra-processed.
  nova: 1 | 2 | 3 | 4;
  whole_grain: boolean;
  // The plant in plain words ("Tomate", "Kichererbse"), for counting variety; null for non-plants.
  plant: string | null;
};

export type BalanceFacts = {
  // All per portion.
  energy_kcal: number;
  fiber_g: number;
  added_sugar_g: number;
  saturated_fat_g: number;
  salt_g: number;
  ingredients: BalanceIngredient[];
};

export type RecipeBalance = BalanceFacts & {
  version: number;
  // Of the ingredients and portions the facts were estimated for (balanceFingerprint).
  fingerprint: string;
};

const amount = (max: number) =>
  z.coerce.number().catch(0).transform((value) => (Number.isFinite(value) ? Math.min(Math.max(value, 0), max) : 0));

// Lenient on purpose: rows can be written straight through the API, and other
// people's recipes may contain anything, so values are clamped instead of trusted.
const StoredIngredientSchema = z.object({
  name: z.string().catch("").transform((value) => value.slice(0, 80)),
  grams: amount(5000),
  group: z.enum(BALANCE_GROUPS).catch("other"),
  nova: z.coerce
    .number()
    .catch(1)
    .transform((value) => (value === 2 || value === 3 || value === 4 ? value : 1) as BalanceIngredient["nova"]),
  whole_grain: z.boolean().catch(false),
  plant: z
    .string()
    .nullable()
    .catch(null)
    .transform((value) => value?.trim().slice(0, 60) || null),
});

const StoredBalanceSchema = z.object({
  version: z.literal(BALANCE_VERSION),
  fingerprint: z.string().max(64),
  energy_kcal: amount(10000),
  fiber_g: amount(500),
  added_sugar_g: amount(1000),
  saturated_fat_g: amount(1000),
  salt_g: amount(200),
  ingredients: z.array(StoredIngredientSchema).max(100),
});

/**
 * The stored facts when they are usable, else null (missing, older version or broken).
 */
export function parseRecipeBalance(value: unknown): RecipeBalance | null {
  const parsed = StoredBalanceSchema.safeParse(value);
  if (!parsed.success || parsed.data.energy_kcal <= 0) return null;
  return parsed.data;
}

/**
 * Short hash of a recipe's ingredients and portions. Facts whose fingerprint no
 * longer matches the recipe were estimated for a different version of it.
 * Spacing, case and order don't count, so "200g Feta" and "200 g feta" match.
 */
export function balanceFingerprint(ingredients: string, servingSize: number): string {
  const lines = ingredients
    .split(/\r?\n/)
    .map((line) => line.toLowerCase().replace(/\s+/g, ""))
    .filter(Boolean)
    .sort();
  const text = `${lines.join("\n")}|${servingSize > 0 ? servingSize : 1}`;

  // FNV-1a, 32 bit: tiny and good enough to notice edits.
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export type BalanceState =
  | { kind: "missing" }
  | { kind: "stale"; balance: RecipeBalance }
  | { kind: "ready"; balance: RecipeBalance };

/**
 * Whether a recipe has facts, and whether they still match its ingredients.
 */
export function getBalanceState(recipe: {
  balance?: unknown;
  ingredients: string;
  serving_size: number;
}): BalanceState {
  const balance = parseRecipeBalance(recipe.balance);
  if (!balance) return { kind: "missing" };
  return balance.fingerprint === balanceFingerprint(recipe.ingredients, recipe.serving_size)
    ? { kind: "ready", balance }
    : { kind: "stale", balance };
}

export type BalanceCategory = {
  id: string;
  label: string;
  points: number;
  max: number;
  // One German sentence on why, e.g. "Ca. 320 g pro Portion – reichlich".
  reason: string;
};

export type BalanceScore = {
  score: number;
  label: string;
  categories: BalanceCategory[];
};

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

// 0 at `zero`, full at `full`; works in both directions.
const linear = (value: number, zero: number, full: number) => clamp01((value - zero) / (full - zero));

const round1 = (value: number) => Math.round(value * 10) / 10;

const formatAmount = (value: number) =>
  value.toLocaleString("de-DE", { maximumFractionDigits: value < 10 ? 1 : 0 });

// Below this, "per 1,000 kcal" would blow small amounts up (a 60 kcal side salad).
const MIN_DENSITY_KCAL = 200;

const gramsOf = (ingredients: BalanceIngredient[], groups: BalanceGroup[]) =>
  ingredients.reduce((sum, ingredient) => (groups.includes(ingredient.group) ? sum + ingredient.grams : sum), 0);

export function balanceLabel(score: number) {
  if (score >= 80) return "Sehr ausgewogen";
  if (score >= 60) return "Ausgewogen";
  if (score >= 40) return "Teils ausgewogen";
  return "Eher selten";
}

export type BalanceTone = "great" | "good" | "fair" | "low";

export function balanceTone(score: number): BalanceTone {
  if (score >= 80) return "great";
  if (score >= 60) return "good";
  if (score >= 40) return "fair";
  return "low";
}

// Recipe thresholds, also shown on /ausgewogenheit.
export const RECIPE_RULES = {
  vegFruitFullPer1000: 300,
  fiberFullPer1000: 15,
  processingZero: 0.35,
  processingFull: 0.85,
  goodProteinMinGrams: 25,
  meatMinGrams: 10,
  satFatFullPct: 10,
  satFatZeroPct: 20,
  sugarFullPct: 5,
  sugarZeroPct: 15,
  saltFullPer1000: 2.5,
  saltZeroPer1000: 5,
} as const;

/**
 * The recipe score: eight categories adding up to 100, based on one portion.
 * Amounts are compared per 1,000 kcal so a small salad and a big casserole are
 * judged by the same standard.
 */
export function scoreRecipe(facts: BalanceFacts): BalanceScore {
  const rules = RECIPE_RULES;
  const kcal = Math.max(facts.energy_kcal, 1);
  const per1000 = (value: number) => (value * 1000) / Math.max(kcal, MIN_DENSITY_KCAL);
  const { ingredients } = facts;
  const categories: BalanceCategory[] = [];
  const add = (id: string, label: string, max: number, share: number, reason: string) =>
    categories.push({ id, label, max, points: round1(max * clamp01(share)), reason });

  const vegFruit = gramsOf(ingredients, ["vegetables", "fruit"]);
  const vegFruitShare = per1000(vegFruit) / rules.vegFruitFullPer1000;
  add(
    "veg_fruit",
    "Gemüse & Obst",
    25,
    vegFruitShare,
    vegFruit < 5
      ? "Kaum Gemüse oder Obst"
      : `Ca. ${formatAmount(vegFruit)} g pro Portion – ${vegFruitShare >= 1 ? "reichlich" : vegFruitShare >= 0.5 ? "ordentlich" : "eher wenig"}`,
  );

  const fiberShare = per1000(facts.fiber_g) / rules.fiberFullPer1000;
  add(
    "fiber",
    "Ballaststoffe",
    15,
    fiberShare,
    `Ca. ${formatAmount(facts.fiber_g)} g pro Portion – ${fiberShare >= 1 ? "viel" : fiberShare >= 0.5 ? "mittel" : "wenig"}`,
  );

  // Culinary ingredients (oil, salt, sugar) are left out; they are judged by fat, sugar and salt.
  const weighted = ingredients.filter((ingredient) => ingredient.nova !== 2 && ingredient.grams > 0);
  const weightedGrams = weighted.reduce((sum, ingredient) => sum + ingredient.grams, 0);
  const unprocessedShare =
    weightedGrams > 0
      ? weighted.reduce(
          (sum, ingredient) => sum + ingredient.grams * (ingredient.nova === 1 ? 1 : ingredient.nova === 3 ? 0.5 : 0),
          0,
        ) / weightedGrams
      : 1;
  const ultraProcessed = weighted.filter((ingredient) => ingredient.nova === 4).map((ingredient) => ingredient.name);
  add(
    "processing",
    "Verarbeitung",
    15,
    linear(unprocessedShare, rules.processingZero, rules.processingFull),
    ultraProcessed.length > 0
      ? `Stark verarbeitet: ${ultraProcessed.slice(0, 3).join(", ")}`
      : unprocessedShare >= rules.processingFull
        ? "Überwiegend frische, unverarbeitete Zutaten"
        : "Einige verarbeitete Zutaten",
  );

  const goodProtein = gramsOf(ingredients, ["legumes", "fish", "nuts_seeds"]);
  const redMeat = gramsOf(ingredients, ["red_meat"]);
  const processedMeat = gramsOf(ingredients, ["processed_meat"]);
  const hasGoodProtein = goodProtein >= rules.goodProteinMinGrams;
  const proteinPoints =
    (hasGoodProtein ? 10 : 6) - (redMeat >= rules.meatMinGrams ? 4 : 0) - (processedMeat >= rules.meatMinGrams ? 6 : 0);
  const proteinNotes = [
    hasGoodProtein ? "Hülsenfrüchte, Fisch oder Nüsse" : null,
    redMeat >= rules.meatMinGrams ? "rotes Fleisch" : null,
    processedMeat >= rules.meatMinGrams ? "Wurst oder Speck" : null,
  ].filter(Boolean);
  add(
    "protein",
    "Eiweißquellen",
    10,
    proteinPoints / 10,
    proteinNotes.length > 0
      ? `Enthält ${proteinNotes.join(", ")}`
      : "Neutral – keine Hülsenfrüchte, kein Fisch, kein rotes Fleisch",
  );

  const grains = ingredients.filter((ingredient) => ingredient.group === "grains");
  const grainGrams = grains.reduce((sum, ingredient) => sum + ingredient.grams, 0);
  const wholeShare =
    grainGrams >= 10
      ? grains.reduce((sum, ingredient) => sum + (ingredient.whole_grain ? ingredient.grams : 0), 0) / grainGrams
      : 1;
  add(
    "whole_grain",
    "Vollkorn",
    10,
    wholeShare,
    grainGrams < 10
      ? "Kein Getreide – kein Abzug"
      : wholeShare >= 0.9
        ? "Getreide als Vollkorn"
        : wholeShare > 0.1
          ? "Teilweise Vollkorn"
          : "Getreide als Weißmehl oder geschält",
  );

  const satFatPct = (facts.saturated_fat_g * 9 * 100) / kcal;
  add(
    "fat",
    "Fettqualität",
    10,
    linear(satFatPct, rules.satFatZeroPct, rules.satFatFullPct),
    `Gesättigte Fette ca. ${formatAmount(satFatPct)} % der Energie${satFatPct <= rules.satFatFullPct ? "" : " – eher viel"}`,
  );

  const sugarPct = (facts.added_sugar_g * 4 * 100) / kcal;
  add(
    "sugar",
    "Zugesetzter Zucker",
    10,
    linear(sugarPct, rules.sugarZeroPct, rules.sugarFullPct),
    facts.added_sugar_g < 1
      ? "Kaum zugesetzter Zucker"
      : `Ca. ${formatAmount(facts.added_sugar_g)} g pro Portion (${formatAmount(sugarPct)} % der Energie)`,
  );

  const saltPer1000 = per1000(facts.salt_g);
  add(
    "salt",
    "Salz",
    5,
    linear(saltPer1000, rules.saltZeroPer1000, rules.saltFullPer1000),
    `Ca. ${formatAmount(facts.salt_g)} g pro Portion${saltPer1000 > rules.saltFullPer1000 ? " – recht salzig" : ""}`,
  );

  const score = Math.round(categories.reduce((sum, category) => sum + category.points, 0));
  return { score, label: balanceLabel(score), categories };
}

// Week thresholds per person, for a fully planned week; also shown on /ausgewogenheit.
export const WEEK_RULES = {
  // Lunch and dinner on seven days. Fewer planned meals shrink the targets.
  fullWeekMeals: 14,
  minScoredMeals: 3,
  legumesFullGrams: 250,
  fishFullGrams: 150,
  meatFullGrams: 300,
  meatZeroGrams: 600,
  plantsFull: 20,
} as const;

export type WeekBalanceMeal = { name: string; facts: BalanceFacts };

export type WeekBalance =
  | { kind: "too-few"; scoredMeals: number; unscoredMeals: number }
  | (BalanceScore & {
      kind: "ready";
      scoredMeals: number;
      unscoredMeals: number;
      recipeAverage: number;
      plantCount: number;
    });

/**
 * The week score: half the average recipe score, half how the week fits
 * together (legumes, fish, meat, plant variety). Each meal counts as one
 * person's portion; targets scale with how many meals are planned.
 */
export function scoreWeek(meals: WeekBalanceMeal[], unscoredMeals = 0): WeekBalance {
  const rules = WEEK_RULES;
  if (meals.length < rules.minScoredMeals) {
    return { kind: "too-few", scoredMeals: meals.length, unscoredMeals };
  }

  const coverage = Math.min(meals.length / rules.fullWeekMeals, 1);
  // The scaled target in words, rounded so it reads like a guideline, not a calculation.
  const target = (grams: number) => `${formatAmount(Math.max(Math.round((grams * coverage) / 10) * 10, 10))} g`;
  const all = meals.flatMap((meal) => meal.facts.ingredients);
  const recipeAverage = meals.reduce((sum, meal) => sum + scoreRecipe(meal.facts).score, 0) / meals.length;
  const categories: BalanceCategory[] = [];
  const add = (id: string, label: string, max: number, share: number, reason: string) =>
    categories.push({ id, label, max, points: round1(max * clamp01(share)), reason });

  add("recipes", "Ø Rezepte", 50, recipeAverage / 100, `Ø ${Math.round(recipeAverage)} von 100 Punkten`);

  const legumes = gramsOf(all, ["legumes"]);
  add(
    "legumes",
    "Hülsenfrüchte",
    15,
    legumes / (rules.legumesFullGrams * coverage),
    `${legumes < 5 ? "Noch keine Hülsenfrüchte" : `Ca. ${formatAmount(legumes)} g pro Person`} – Ziel ab ${target(rules.legumesFullGrams)}`,
  );

  const fish = gramsOf(all, ["fish"]);
  add(
    "fish",
    "Fisch",
    10,
    fish / (rules.fishFullGrams * coverage),
    `${fish < 5 ? "Noch kein Fisch" : `Ca. ${formatAmount(fish)} g pro Person`} – Ziel ab ${target(rules.fishFullGrams)}`,
  );

  const meat = gramsOf(all, ["red_meat", "processed_meat", "poultry"]);
  add(
    "meat",
    "Fleisch & Wurst",
    15,
    linear(meat, rules.meatZeroGrams * coverage, rules.meatFullGrams * coverage),
    meat < 5
      ? "Kein Fleisch"
      : `Ca. ${formatAmount(meat)} g pro Person – empfohlen bis ${target(rules.meatFullGrams)}`,
  );

  const plants = new Set(
    all.map((ingredient) => ingredient.plant?.toLowerCase().trim()).filter((plant): plant is string => Boolean(plant)),
  );
  add(
    "plants",
    "Pflanzenvielfalt",
    10,
    plants.size / (rules.plantsFull * coverage),
    `${plants.size} verschiedene Pflanzen – Ziel ab ${Math.max(Math.round(rules.plantsFull * coverage), 1)}`,
  );

  const score = Math.round(categories.reduce((sum, category) => sum + category.points, 0));
  return {
    kind: "ready",
    score,
    label: balanceLabel(score),
    categories,
    scoredMeals: meals.length,
    unscoredMeals,
    recipeAverage: Math.round(recipeAverage),
    plantCount: plants.size,
  };
}
