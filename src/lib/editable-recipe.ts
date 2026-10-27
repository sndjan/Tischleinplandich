// The recipe as the editor works with it: ingredients as rows and steps as a list.
// It is stored as plain text lines (as before), so the shopping list keeps working.

import type { Recipe } from "@/types/database";
import type { RecipeDraft } from "@/lib/recipe-draft";

export type IngredientRow = {
  id: string;
  quantity: string;
  unit: string;
  name: string;
};

export type EditableRecipe = {
  name: string;
  ingredients: IngredientRow[];
  steps: string[];
  prep_time: string;
  serving_size: number;
  calories: string;
  protein: string;
  carbs: string;
  fats: string;
  tags: string[];
  source_url: string;
  is_public: boolean;
};

export const INGREDIENT_UNITS = [
  "g",
  "kg",
  "ml",
  "l",
  "EL",
  "TL",
  "Prise",
  "Stück",
  "Zehe",
  "Bund",
  "Dose",
  "Packung",
  "Scheibe",
  "Becher",
  "Tasse",
  "Glas",
  "Handvoll",
] as const;

// Spellings that map onto one of the units above (lowercased keys).
const UNIT_SPELLINGS: Record<string, string> = {
  g: "g",
  gr: "g",
  gramm: "g",
  kg: "kg",
  ml: "ml",
  l: "l",
  liter: "l",
  el: "EL",
  essl: "EL",
  esslöffel: "EL",
  tl: "TL",
  teel: "TL",
  teelöffel: "TL",
  prise: "Prise",
  prisen: "Prise",
  stück: "Stück",
  stk: "Stück",
  "stk.": "Stück",
  zehe: "Zehe",
  zehen: "Zehe",
  bund: "Bund",
  dose: "Dose",
  dosen: "Dose",
  packung: "Packung",
  packungen: "Packung",
  pck: "Packung",
  "pck.": "Packung",
  pkg: "Packung",
  scheibe: "Scheibe",
  scheiben: "Scheibe",
  becher: "Becher",
  tasse: "Tasse",
  tassen: "Tasse",
  glas: "Glas",
  gläser: "Glas",
  handvoll: "Handvoll",
};

const QUANTITY_PATTERN =
  /^((?:\d+(?:[.,]\d+)?|\d+\/\d+|[½¼¾⅓⅔⅛])(?:\s*[-–]\s*(?:\d+(?:[.,]\d+)?))?)\s*/;

export const newRowId = () => crypto.randomUUID();

export function parseIngredientLine(line: string): IngredientRow {
  let rest = line
    .trim()
    .replace(/^[-•*]\s*/, "")
    .replace(/\s+/g, " ");
  let quantity = "";
  let unit = "";

  const quantityMatch = rest.match(QUANTITY_PATTERN);
  if (quantityMatch) {
    quantity = quantityMatch[1].replace(/\s+/g, "");
    rest = rest.slice(quantityMatch[0].length);
  }

  // "200g" leaves "g Orzo"; "2 EL Öl" leaves "EL Öl".
  const unitMatch = rest.match(/^(\S+)\s+(.*)$/);
  if (quantity && unitMatch) {
    const canonical = UNIT_SPELLINGS[unitMatch[1].toLowerCase()];
    if (canonical) {
      unit = canonical;
      rest = unitMatch[2];
    }
  }

  return { id: newRowId(), quantity, unit, name: rest.trim() };
}

export const formatIngredientRow = (row: IngredientRow) =>
  [row.quantity.trim(), row.unit.trim(), row.name.trim()].filter(Boolean).join(" ");

export const formatIngredientAmount = (row: IngredientRow) =>
  [row.quantity.trim(), row.unit.trim()].filter(Boolean).join(" ");

const splitLines = (text: string | null | undefined) =>
  (text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

// Steps are stored one per line; a leading "1." is display-only.
const parseSteps = (text: string | null | undefined) =>
  splitLines(text).map((line) => line.replace(/^\d+[.)]\s*/, ""));

const numberToField = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

export function editableFromDraft(draft: RecipeDraft): EditableRecipe {
  return {
    name: draft.name,
    ingredients: splitLines(draft.ingredients).map(parseIngredientLine),
    steps: parseSteps(draft.preparation_steps),
    prep_time: draft.prep_time,
    serving_size: draft.serving_size > 0 ? draft.serving_size : 1,
    calories: numberToField(draft.calories),
    protein: numberToField(draft.protein),
    carbs: numberToField(draft.carbs),
    fats: numberToField(draft.fats),
    tags: draft.tags,
    source_url: draft.source_url,
    is_public: false,
  };
}

export function editableFromRecipe(recipe: Recipe, tags: string[]): EditableRecipe {
  return {
    name: recipe.name,
    ingredients: splitLines(recipe.ingredients).map(parseIngredientLine),
    steps: parseSteps(recipe.preparation_steps),
    prep_time: recipe.prep_time ?? "",
    serving_size: recipe.serving_size || 1,
    calories: numberToField(recipe.calories),
    protein: numberToField(recipe.protein),
    carbs: numberToField(recipe.carbs),
    fats: numberToField(recipe.fats),
    tags,
    source_url: recipe.source_url ?? "",
    is_public: recipe.is_public,
  };
}

export const emptyEditableRecipe = (): EditableRecipe => ({
  name: "",
  ingredients: [],
  steps: [],
  prep_time: "",
  serving_size: 2,
  calories: "",
  protein: "",
  carbs: "",
  fats: "",
  tags: [],
  source_url: "",
  is_public: false,
});

const fieldToNumber = (value: string) => {
  const parsed = parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * The recipe as a draft, e.g. to send it to the AI for changes.
 */
export function draftFromEditable(recipe: EditableRecipe): RecipeDraft {
  return {
    name: recipe.name.trim(),
    ingredients: recipe.ingredients.map(formatIngredientRow).filter(Boolean).join("\n"),
    preparation_steps: recipe.steps
      .map((step) => step.trim())
      .filter(Boolean)
      .join("\n"),
    source_url: recipe.source_url.trim(),
    prep_time: recipe.prep_time.trim(),
    tags: recipe.tags,
    calories: fieldToNumber(recipe.calories),
    protein: fieldToNumber(recipe.protein),
    carbs: fieldToNumber(recipe.carbs),
    fats: fieldToNumber(recipe.fats),
    serving_size: recipe.serving_size,
  };
}

/**
 * Ingredient names from the user's recipes, for suggestions while typing.
 */
export function collectIngredientNames(recipes: Recipe[]): string[] {
  const names = new Map<string, string>();

  for (const recipe of recipes) {
    for (const line of splitLines(recipe.ingredients)) {
      const name = parseIngredientLine(line).name;
      if (name && name.length <= 40 && !names.has(name.toLowerCase())) {
        names.set(name.toLowerCase(), name);
      }
    }
  }

  return [...names.values()].sort((a, b) => a.localeCompare(b, "de"));
}
