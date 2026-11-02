// "Details neu berechnen": the AI recomputes nutrition, the balance facts and the
// details of a recipe the user edited, but the recipe's text stays the user's.

import { balanceFingerprint } from "@/lib/balance";
import { ingredientLines } from "@/lib/ingredient-lines";
import { detailsFingerprint } from "@/lib/recipe-details";
import type { RecipeDraft } from "@/lib/recipe-draft";

const countSteps = (steps: string) => steps.split(/\r?\n/).filter((line) => line.trim()).length;

/**
 * Takes the computed values from `computed` (the model's version of the recipe)
 * and everything the user wrote from `original`.
 *
 * Per-ingredient and per-step details refer to lines by position. They are kept
 * only when the model returned as many ingredient lines and steps as the user's
 * recipe has; otherwise the rest of the details still applies without them.
 */
export function mergeRecalculated(original: RecipeDraft, computed: RecipeDraft): RecipeDraft {
  const servingSize = original.serving_size > 0 ? original.serving_size : 1;
  const linesAlign =
    ingredientLines(original.ingredients).length === ingredientLines(computed.ingredients).length &&
    countSteps(original.preparation_steps) === countSteps(computed.preparation_steps);

  const details = computed.details
    ? linesAlign
      ? { ...computed.details, fingerprint: detailsFingerprint(original.ingredients, original.preparation_steps) }
      : { ...computed.details, fingerprint: "", ingredients: [], steps: [] }
    : original.details;

  // The facts are estimated per portion for this recipe, so they describe the
  // user's text as well; the fingerprint marks them as current for it.
  const balance = computed.balance
    ? { ...computed.balance, fingerprint: balanceFingerprint(original.ingredients, servingSize) }
    : original.balance;

  return {
    ...original,
    serving_size: servingSize,
    // A time the user typed in wins over the estimate.
    prep_time: original.prep_time.trim() || computed.prep_time,
    calories: computed.calories ?? original.calories,
    protein: computed.protein ?? original.protein,
    carbs: computed.carbs ?? original.carbs,
    fats: computed.fats ?? original.fats,
    balance,
    details,
  };
}
