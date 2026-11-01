import { formatCount, formatMeasure } from "@/lib/shopping-sections";
import { parseIngredientLine, type IngredientRow } from "@/lib/editable-recipe";
import { ingredientLines } from "@/lib/ingredient-lines";
import { formatFraction, type StepInfo } from "@/lib/recipe-details";

const GLYPHS: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125 };

function parseNumber(text: string): number | null {
  const clean = text.trim().replace(",", ".");
  if (clean in GLYPHS) return GLYPHS[clean];
  const fraction = clean.match(/^(\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const value = Number(clean);
  return Number.isFinite(value) ? value : null;
}

function formatScaled(value: number, unit: string) {
  if (unit === "g" || unit === "ml") return formatMeasure(value);
  if (unit === "kg" || unit === "l") return value.toLocaleString("de-DE", { maximumFractionDigits: 2 });
  return formatCount(value);
}

/**
 * Scales an amount like "200", "1,5", "½" or "2-3" by the given factor and
 * writes it the way a cook would ("1½", "65"). Amounts that aren't numbers stay.
 */
export function scaleQuantity(quantity: string, unit: string, factor: number): string {
  if (!quantity || factor === 1) return quantity;

  const [from, to] = quantity.split(/[-–]/);
  const start = parseNumber(from ?? "");
  if (start === null) return quantity;

  const end = to !== undefined ? parseNumber(to) : null;
  const scaledStart = formatScaled(start * factor, unit);
  return end !== null ? `${scaledStart}–${formatScaled(end * factor, unit)}` : scaledStart;
}

export type ScaledIngredient = IngredientRow & {
  amount: string;
  // Group header above the line ("Für die Soße"), null without groups.
  group: string | null;
};

/**
 * The recipe's ingredients (group headers left out, each line knowing its group),
 * with amounts scaled by the factor.
 */
export function scaleIngredients(ingredients: string | null, factor: number): ScaledIngredient[] {
  return ingredientLines(ingredients).map(({ line, group }) => {
    const row = parseIngredientLine(line);
    const quantity = scaleQuantity(row.quantity, row.unit, factor);
    return { ...row, quantity, amount: [quantity, row.unit].filter(Boolean).join(" "), group };
  });
}

/**
 * Splits ingredients into runs of the same group, for lists with group headings.
 */
export function groupIngredients<T extends { group: string | null }>(ingredients: T[]): Array<{ group: string | null; items: T[] }> {
  const groups: Array<{ group: string | null; items: T[] }> = [];
  for (const ingredient of ingredients) {
    const last = groups[groups.length - 1];
    if (last && last.group === ingredient.group) last.items.push(ingredient);
    else groups.push({ group: ingredient.group, items: [ingredient] });
  }
  return groups;
}

/**
 * The ingredients a step uses with the amount for that step, from the AI's step
 * details: "½" of 2 onions becomes "1". Amounts that can't be split ("1 Prise")
 * get the share in front ("½ · 1 Prise").
 */
export function stepIngredientAmounts(
  step: StepInfo,
  ingredients: string | null,
  factor: number,
): ScaledIngredient[] {
  const lines = ingredientLines(ingredients);

  return step.uses.flatMap(({ i, fraction }) => {
    const entry = lines[i];
    if (!entry) return [];

    const row = parseIngredientLine(entry.line);
    const share = fraction === null || fraction >= 0.99 ? 1 : fraction;
    const quantity = scaleQuantity(row.quantity, row.unit, factor * share);
    // "1 Prise" or "etwas" can't be split, so the share goes in front.
    const scalable = scaleQuantity(row.quantity, row.unit, 2) !== row.quantity;
    const amount =
      share === 1 || scalable || !row.quantity
        ? [quantity, row.unit].filter(Boolean).join(" ")
        : `${formatFraction(share)} · ${[scaleQuantity(row.quantity, row.unit, factor), row.unit].filter(Boolean).join(" ")}`;

    return [{ ...row, id: `${row.id}-${i}`, quantity, amount, group: entry.group }];
  });
}

// The word a step would mention an ingredient by: usually the last word of its
// name ("rote Linsen" → "linsen"), cut to a stem so "Zwiebel" finds "Zwiebeln".
function ingredientStem(name: string) {
  const main = name.split(/[,(]/)[0]?.trim().toLowerCase() ?? "";
  const word = main.split(/\s+/).filter((part) => part.length >= 3).pop() ?? "";
  return word.length > 6 ? word.slice(0, 6) : word;
}

/**
 * Ingredients a preparation step mentions, so cooking mode can show them with it.
 */
export function ingredientsForStep<T extends { name: string }>(step: string, ingredients: T[]): T[] {
  const text = step.toLowerCase();
  return ingredients.filter((ingredient) => {
    const stem = ingredientStem(ingredient.name);
    return stem.length >= 3 && text.includes(stem);
  });
}

export type StepTimer = { seconds: number; label: string; index: number; length: number };

const TIME_PATTERN =
  /(\d+(?:[.,]\d+)?)(?:\s*(?:-|–|bis)\s*\d+(?:[.,]\d+)?)?\s*(stunden|stunde|std\.?|minuten|minute|min\.?|sekunden|sek\.?)(?![a-zäöü])/i;

/**
 * The first duration in a step ("15 Minuten", "1-2 Std."), for a timer button.
 * Ranges use the shorter time, so nothing burns while the cook checks.
 */
export function findStepTimer(step: string): StepTimer | null {
  const match = TIME_PATTERN.exec(step);
  if (!match) return null;

  const value = Number(match[1].replace(",", "."));
  const unit = match[2].toLowerCase();
  const multiplier = unit.startsWith("st") ? 3600 : unit.startsWith("se") ? 1 : 60;
  const seconds = Math.round(value * multiplier);
  if (!seconds) return null;

  return { seconds, label: match[0], index: match.index, length: match[0].length };
}

export const formatTimer = (seconds: number) => {
  const safe = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const rest = String(safe % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${String(minutes).padStart(2, "0")}:${rest}`;
};
