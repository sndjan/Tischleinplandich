import { describe, expect, it } from "vitest";
import { balanceFingerprint, getBalanceState, type RecipeBalance } from "@/lib/balance";
import { detailsMatch, emptyRecipeDetails, type RecipeDetails } from "@/lib/recipe-details";
import type { RecipeDraft } from "@/lib/recipe-draft";
import { mergeRecalculated } from "@/lib/recipe-recalculate";

const facts = (fingerprint: string): RecipeBalance => ({
  version: 1,
  fingerprint,
  energy_kcal: 500,
  fiber_g: 8,
  added_sugar_g: 0,
  saturated_fat_g: 3,
  salt_g: 1,
  ingredients: [],
});

const details = (): RecipeDetails => ({
  ...emptyRecipeDetails(),
  fingerprint: "model",
  equipment: ["Topf"],
  ingredients: [
    { base_name: "Nudel", section: "dry", pantry: false, perishable: false, kcal: 700, protein: 20, carbs: 140, fat: 3 },
    { base_name: "Zwiebel", section: "produce", pantry: false, perishable: false, kcal: 80, protein: 2, carbs: 18, fat: 0 },
  ],
  steps: [{ uses: [{ i: 0, fraction: null }] }, { uses: [{ i: 1, fraction: 0.5 }] }],
});

const original: RecipeDraft = {
  name: "Meine Pasta",
  ingredients: "# Für die Pasta\n200g Nudeln\n2 Zwiebeln",
  preparation_steps: "Nudeln kochen, wie immer\nZwiebeln anbraten",
  source_url: "https://example.com/pasta",
  prep_time: "",
  tags: ["Abendessen"],
  calories: 900,
  protein: null,
  carbs: null,
  fats: null,
  serving_size: 2,
  balance: null,
  details: null,
  source_text: "Quelltext",
};

const computed: RecipeDraft = {
  ...original,
  name: "Pasta mit Zwiebeln",
  ingredients: "200 g Nudeln\n2 Zwiebeln",
  preparation_steps: "Nudeln 10 Min. kochen.\nZwiebeln anbraten.",
  prep_time: "25 Min.",
  tags: ["Pasta"],
  calories: 420,
  protein: 12,
  carbs: 80,
  fats: 4,
  balance: facts("model"),
  details: details(),
  source_text: null,
};

describe("mergeRecalculated", () => {
  it("keeps the user's text and takes the computed values", () => {
    const merged = mergeRecalculated(original, computed);
    expect(merged.name).toBe("Meine Pasta");
    expect(merged.ingredients).toBe(original.ingredients);
    expect(merged.preparation_steps).toBe(original.preparation_steps);
    expect(merged.tags).toEqual(["Abendessen"]);
    expect(merged.source_text).toBe("Quelltext");
    expect(merged).toMatchObject({ calories: 420, protein: 12, carbs: 80, fats: 4, prep_time: "25 Min." });
    expect(merged.details?.equipment).toEqual(["Topf"]);
  });

  it("marks balance and per-line details as current for the user's text", () => {
    const merged = mergeRecalculated(original, computed);
    expect(merged.balance?.fingerprint).toBe(balanceFingerprint(original.ingredients, 2));
    expect(getBalanceState(merged).kind).toBe("ready");
    expect(detailsMatch(merged.details, merged)).toBe(true);
    expect(merged.details?.steps).toHaveLength(2);
  });

  it("drops per-line details when the model returned other lines", () => {
    const merged = mergeRecalculated(original, { ...computed, ingredients: "200 g Nudeln\n2 Zwiebeln\nSalz" });
    expect(merged.details?.ingredients).toEqual([]);
    expect(merged.details?.steps).toEqual([]);
    expect(detailsMatch(merged.details, merged)).toBe(false);
    expect(merged.details?.equipment).toEqual(["Topf"]);
  });

  it("keeps a time the user typed and old values the model left out", () => {
    const merged = mergeRecalculated(
      { ...original, prep_time: "1 Std." },
      { ...computed, calories: null, balance: null, details: null },
    );
    expect(merged.prep_time).toBe("1 Std.");
    expect(merged.calories).toBe(900);
    expect(merged.balance).toBeNull();
    expect(merged.details).toBeNull();
  });
});
