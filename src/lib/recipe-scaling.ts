import { formatCount, formatMeasure } from "@/lib/shopping-sections";
import { parseIngredientLine, type IngredientRow } from "@/lib/editable-recipe";

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

export type ScaledIngredient = IngredientRow & { amount: string };

export function scaleIngredients(ingredients: string | null, factor: number): ScaledIngredient[] {
  return (ingredients ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const row = parseIngredientLine(line);
      const quantity = scaleQuantity(row.quantity, row.unit, factor);
      return { ...row, quantity, amount: [quantity, row.unit].filter(Boolean).join(" ") };
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
