import type { PlannedMeal, Recipe, ShoppingListItem } from "@/types/database";

type Conversion = {
  group: "weight" | "volume";
  toBase: number;
  baseUnit: "g" | "ml";
};

const FRACTION_CHAR_MAP: Record<string, number> = {
  "¼": 0.25,
  "½": 0.5,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

const UNIT_ALIASES: Record<string, string> = {
  g: "g",
  gr: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilo: "kg",
  kilos: "kg",
  mg: "mg",
  ml: "ml",
  l: "l",
  liter: "l",
  litre: "l",
  liters: "l",
  litres: "l",
  dl: "dl",
  cl: "cl",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tl: "tsp",
  tbsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  el: "tbsp",
  cup: "cup",
  cups: "cup",
  pc: "pc",
  pcs: "pc",
  piece: "pc",
  pieces: "pc",
  x: "pc",
  stk: "pc",
  stueck: "pc",
  stück: "pc",
  can: "can",
  cans: "can",
  dose: "can",
  pack: "pack",
  packs: "pack",
  package: "pack",
  packages: "pack",
  packung: "pack",
  pinch: "pinch",
  prise: "pinch",
  cloves: "clove",
  clove: "clove",
  zehe: "clove",
  zehen: "clove",
};

const CONVERSIONS: Record<string, Conversion> = {
  mg: { group: "weight", toBase: 0.001, baseUnit: "g" },
  g: { group: "weight", toBase: 1, baseUnit: "g" },
  kg: { group: "weight", toBase: 1000, baseUnit: "g" },
  ml: { group: "volume", toBase: 1, baseUnit: "ml" },
  cl: { group: "volume", toBase: 10, baseUnit: "ml" },
  dl: { group: "volume", toBase: 100, baseUnit: "ml" },
  l: { group: "volume", toBase: 1000, baseUnit: "ml" },
};

function normalizeIngredientName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function parseSimpleFraction(token: string): number | null {
  if (!token) {
    return null;
  }

  const clean = token.trim().replace(",", ".");

  if (FRACTION_CHAR_MAP[clean] !== undefined) {
    return FRACTION_CHAR_MAP[clean] ?? null;
  }

  if (/^\d+(?:\.\d+)?$/.test(clean)) {
    return Number.parseFloat(clean);
  }

  const fractionMatch = clean.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const numerator = Number.parseFloat(fractionMatch[1] ?? "0");
    const denominator = Number.parseFloat(fractionMatch[2] ?? "1");

    if (denominator > 0) {
      return numerator / denominator;
    }
  }

  return null;
}

function normalizeUnit(unitToken: string): string {
  if (!unitToken) {
    return "";
  }

  const sanitized = unitToken
    .trim()
    .toLowerCase()
    .replace(/[.,]$/, "")
    .replace(/[()]/g, "");

  if (UNIT_ALIASES[sanitized]) {
    return UNIT_ALIASES[sanitized] ?? "";
  }

  if (sanitized.endsWith("s") && UNIT_ALIASES[sanitized.slice(0, -1)]) {
    return UNIT_ALIASES[sanitized.slice(0, -1)] ?? "";
  }

  return "";
}

function parseLeadingQuantity(tokens: string[]): {
  quantity: number | null;
  consumedTokens: number;
  attachedUnit: string;
} {
  const first = tokens[0] ?? "";
  const second = tokens[1] ?? "";

  const firstParsed = parseSimpleFraction(first);
  if (firstParsed !== null) {
    if (/^\d+$/.test(first) && second.includes("/")) {
      const secondParsed = parseSimpleFraction(second);
      if (secondParsed !== null) {
        return {
          quantity: firstParsed + secondParsed,
          consumedTokens: 2,
          attachedUnit: "",
        };
      }
    }

    return {
      quantity: firstParsed,
      consumedTokens: 1,
      attachedUnit: "",
    };
  }

  const attachedMatch = first.match(/^(\d+(?:[.,]\d+)?)([a-zA-ZäöüÄÖÜ]+)$/);
  if (attachedMatch) {
    return {
      quantity: Number.parseFloat((attachedMatch[1] ?? "1").replace(",", ".")),
      consumedTokens: 1,
      attachedUnit: normalizeUnit(attachedMatch[2] ?? ""),
    };
  }

  return {
    quantity: null,
    consumedTokens: 0,
    attachedUnit: "",
  };
}

function roundQuantity(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function toBaseUnit(
  quantity: number,
  unit: string,
): { quantity: number; unit: string } {
  const conversion = CONVERSIONS[unit];
  if (!conversion) {
    return { quantity, unit };
  }

  return {
    quantity: quantity * conversion.toBase,
    unit: conversion.baseUnit,
  };
}

function toDisplayUnit(
  quantity: number,
  unit: string,
): { quantity: number; unit: string } {
  if (unit === "g" && quantity >= 1000) {
    return {
      quantity: quantity / 1000,
      unit: "kg",
    };
  }

  if (unit === "ml" && quantity >= 1000) {
    return {
      quantity: quantity / 1000,
      unit: "l",
    };
  }

  return { quantity, unit };
}

function parseIngredientLines(
  ingredients: string,
  multiplier: number,
  source?: string,
): ShoppingListItem[] {
  if (!ingredients || multiplier <= 0) {
    return [];
  }

  return ingredients
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => parseIngredient(line))
    .filter((item) => item.ingredient.length > 0)
    .map((item) => ({
      ingredient: item.ingredient,
      quantity: roundQuantity(item.quantity * multiplier),
      unit: item.unit,
      label: item.label,
      sources: source ? [source] : [],
    }));
}

/**
 * Parse ingredient string to extract quantity and unit
 * e.g., "200g flour" -> { ingredient: "flour", quantity: 200, unit: "g" }
 */
export function parseIngredient(ingredientLine: string): {
  ingredient: string;
  quantity: number;
  unit: string;
  label: string;
} {
  const cleanedLine = ingredientLine
    .trim()
    .replace(/^[-•*]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/\s+/g, " ");

  if (!cleanedLine) {
    return {
      ingredient: "",
      quantity: 0,
      unit: "",
      label: "",
    };
  }

  const tokens = cleanedLine.split(" ");
  const parsedQuantity = parseLeadingQuantity(tokens);

  let quantity = parsedQuantity.quantity ?? 1;
  if (!Number.isFinite(quantity) || quantity <= 0) {
    quantity = 1;
  }

  let cursor = parsedQuantity.consumedTokens;
  let unit = parsedQuantity.attachedUnit;

  if (!unit && cursor < tokens.length) {
    const unitCandidate = normalizeUnit(tokens[cursor] ?? "");
    if (unitCandidate) {
      unit = unitCandidate;
      cursor += 1;
    }
  }

  const rawName = tokens.slice(cursor).join(" ").trim() || cleanedLine;

  return {
    ingredient: normalizeIngredientName(rawName),
    quantity,
    unit,
    label: rawName.charAt(0).toUpperCase() + rawName.slice(1),
  };
}

/**
 * Merge shopping list items intelligently
 * Combines quantities for identical ingredients and compatible units
 * Keeps separate entries for different ingredient variants
 */
export function mergeShoppingList(
  items: ShoppingListItem[],
): ShoppingListItem[] {
  const grouped = new Map<string, ShoppingListItem>();

  for (const item of items) {
    const ingredientName = normalizeIngredientName(item.ingredient);

    if (!ingredientName) {
      continue;
    }

    const normalizedUnit =
      normalizeUnit(item.unit) || item.unit.trim().toLowerCase();
    const normalizedQuantity = Number.isFinite(item.quantity)
      ? item.quantity
      : 0;
    const baseValue = toBaseUnit(normalizedQuantity, normalizedUnit);
    const key = `${ingredientName}|${baseValue.unit}`;

    const existing = grouped.get(key);

    if (existing) {
      existing.quantity = roundQuantity(existing.quantity + baseValue.quantity);
      for (const source of item.sources ?? []) {
        if (!existing.sources?.includes(source)) existing.sources?.push(source);
      }
    } else {
      grouped.set(key, {
        ingredient: ingredientName,
        quantity: roundQuantity(baseValue.quantity),
        unit: baseValue.unit,
        label: item.label,
        sources: [...(item.sources ?? [])],
      });
    }
  }

  return Array.from(grouped.values())
    .map((item) => {
      const display = toDisplayUnit(item.quantity, item.unit);
      return {
        ...item,
        quantity: roundQuantity(display.quantity),
        unit: display.unit,
      };
    })
    .sort((first, second) => first.ingredient.localeCompare(second.ingredient));
}

/**
 * Generate shopping list from recipe ingredients
 */
export function generateShoppingListFromRecipes(
  recipes: Array<{ ingredients: string; serving_size?: number | null }>,
  portionMultipliers?: Partial<Record<number, number>>,
): ShoppingListItem[] {
  const items: ShoppingListItem[] = [];

  recipes.forEach((recipe, index) => {
    const configuredMultiplier = portionMultipliers?.[index] ?? 1;
    const recipeServingSize =
      recipe.serving_size && recipe.serving_size > 0 ? recipe.serving_size : 1;
    const finalMultiplier = configuredMultiplier / recipeServingSize;

    items.push(...parseIngredientLines(recipe.ingredients, finalMultiplier));
  });

  return mergeShoppingList(items);
}

/**
 * Generate shopping list from current planned meals and recipes
 */
export function generateShoppingListFromPlannedMeals(
  plannedMeals: Array<Pick<PlannedMeal, "recipe_id" | "serving_size">>,
  recipes: Array<Pick<Recipe, "id" | "name" | "ingredients" | "serving_size">>,
): ShoppingListItem[] {
  if (plannedMeals.length === 0 || recipes.length === 0) {
    return [];
  }

  const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const items: ShoppingListItem[] = [];

  for (const plannedMeal of plannedMeals) {
    const recipe = recipesById.get(plannedMeal.recipe_id);
    if (!recipe) {
      continue;
    }

    const plannedServings =
      plannedMeal.serving_size && plannedMeal.serving_size > 0
        ? plannedMeal.serving_size
        : 1;
    const recipeServings =
      recipe.serving_size && recipe.serving_size > 0 ? recipe.serving_size : 1;

    const multiplier = plannedServings / recipeServings;
    items.push(...parseIngredientLines(recipe.ingredients, multiplier, recipe.name));
  }

  return mergeShoppingList(items);
}

/**
 * Normalizes a pantry staple the way it is stored in the pantry_staples table
 * (lowercase, single spaces), so user input matches ingredient names.
 */
export function normalizePantryStapleName(name: string): string {
  return normalizeIngredientName(name);
}

/**
 * Whether an ingredient is one of the user's pantry staples (olive oil, oregano,
 * salt, ...). Matches on the trailing words so "getrockneter oregano" counts, but
 * "flour tortillas" or "red bell pepper" do not.
 */
export function isBasicIngredient(
  ingredient: string,
  pantryStaples: readonly string[],
): boolean {
  const name = normalizeIngredientName(ingredient)
    .split(/[,(]/)[0]
    ?.replace(/\s+(zum|zur|für|nach|to|for)\s.*$/, "")
    .trim();

  if (!name) {
    return false;
  }

  return pantryStaples.some(
    (staple) => name === staple || name.endsWith(` ${staple}`),
  );
}
