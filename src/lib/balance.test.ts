import { describe, expect, it } from "vitest";
import {
  BALANCE_VERSION,
  balanceFingerprint,
  getBalanceState,
  parseRecipeBalance,
  scoreRecipe,
  scoreWeek,
  type BalanceFacts,
  type BalanceIngredient,
} from "@/lib/balance";

const ingredient = (patch: Partial<BalanceIngredient>): BalanceIngredient => ({
  name: "Zutat",
  grams: 100,
  group: "vegetables",
  nova: 1,
  whole_grain: false,
  plant: null,
  ...patch,
});

const lentilCurry: BalanceFacts = {
  energy_kcal: 520,
  fiber_g: 14,
  added_sugar_g: 0,
  saturated_fat_g: 4,
  salt_g: 1.2,
  ingredients: [
    ingredient({ name: "Rote Linsen", grams: 80, group: "legumes", plant: "Linse" }),
    ingredient({ name: "Tomaten", grams: 150, plant: "Tomate" }),
    ingredient({ name: "Spinat", grams: 80, plant: "Spinat" }),
    ingredient({ name: "Zwiebel", grams: 40, plant: "Zwiebel" }),
    ingredient({ name: "Vollkornreis", grams: 70, group: "grains", whole_grain: true, plant: "Reis" }),
    ingredient({ name: "Rapsöl", grams: 10, group: "fats_oils", nova: 2 }),
  ],
};

const carbonara: BalanceFacts = {
  energy_kcal: 850,
  fiber_g: 3,
  added_sugar_g: 0,
  saturated_fat_g: 18,
  salt_g: 3.5,
  ingredients: [
    ingredient({ name: "Spaghetti", grams: 125, group: "grains", plant: "Weizen" }),
    ingredient({ name: "Speck", grams: 60, group: "processed_meat", nova: 3 }),
    ingredient({ name: "Parmesan", grams: 30, group: "dairy", nova: 3 }),
    ingredient({ name: "Eier", grams: 60, group: "eggs" }),
  ],
};

describe("scoreRecipe", () => {
  it("rates a vegetable-rich lentil curry highly", () => {
    const result = scoreRecipe(lentilCurry);
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.label).toBe("Sehr ausgewogen");
    expect(result.categories.find((category) => category.id === "protein")?.points).toBe(10);
  });

  it("rates a bacon carbonara low and explains why", () => {
    const result = scoreRecipe(carbonara);
    expect(result.score).toBeLessThan(40);
    const protein = result.categories.find((category) => category.id === "protein")!;
    expect(protein.points).toBe(0);
    expect(protein.reason).toContain("Wurst oder Speck");
    expect(result.categories.find((category) => category.id === "salt")?.reason).toContain("recht salzig");
  });

  it("has categories that add up to 100", () => {
    expect(scoreRecipe(lentilCurry).categories.reduce((sum, category) => sum + category.max, 0)).toBe(100);
  });

  it("does not punish recipes without grains in the whole-grain category", () => {
    const salad: BalanceFacts = { ...lentilCurry, ingredients: [ingredient({ grams: 250 })] };
    expect(scoreRecipe(salad).categories.find((category) => category.id === "whole_grain")?.points).toBe(10);
  });

  it("names ultra-processed ingredients", () => {
    const result = scoreRecipe({
      ...lentilCurry,
      ingredients: [...lentilCurry.ingredients, ingredient({ name: "Fertigsoße", grams: 200, group: "condiments", nova: 4 })],
    });
    expect(result.categories.find((category) => category.id === "processing")?.reason).toContain("Fertigsoße");
  });

  it("does not inflate amounts for very light dishes", () => {
    const side: BalanceFacts = { ...lentilCurry, energy_kcal: 50, salt_g: 0.8 };
    // 0.8 g salt counts per 200 kcal (4 g / 1,000 kcal), not per 50 kcal (16 g).
    expect(scoreRecipe(side).categories.find((category) => category.id === "salt")?.points).toBe(2);
  });
});

describe("scoreWeek", () => {
  it("needs at least three scored meals", () => {
    expect(scoreWeek([{ name: "Curry", facts: lentilCurry }], 2)).toEqual({
      kind: "too-few",
      scoredMeals: 1,
      unscoredMeals: 2,
    });
  });

  it("rewards legumes and plant variety and stays within 0–100", () => {
    const week = scoreWeek(Array.from({ length: 4 }, () => ({ name: "Curry", facts: lentilCurry })));
    expect(week.kind).toBe("ready");
    if (week.kind !== "ready") return;
    expect(week.categories.find((category) => category.id === "legumes")?.points).toBe(15);
    expect(week.categories.find((category) => category.id === "fish")?.reason).toBe("Noch kein Fisch – Ziel ab 40 g");
    expect(week.plantCount).toBe(5);
    expect(week.score).toBeGreaterThan(70);
    expect(week.score).toBeLessThanOrEqual(100);
  });

  it("marks down a week with a lot of meat", () => {
    const week = scoreWeek(Array.from({ length: 7 }, () => ({ name: "Carbonara", facts: carbonara })));
    if (week.kind !== "ready") throw new Error("expected a score");
    expect(week.categories.find((category) => category.id === "meat")?.points).toBe(0);
    expect(week.score).toBeLessThan(30);
  });
});

describe("balanceFingerprint", () => {
  it("ignores spacing, case and order", () => {
    expect(balanceFingerprint("200g Feta\n1 Gurke", 2)).toBe(balanceFingerprint("1 gurke\n200 g Feta\n", 2));
  });

  it("changes with amounts and portions", () => {
    const base = balanceFingerprint("200 g Feta", 2);
    expect(balanceFingerprint("400 g Feta", 2)).not.toBe(base);
    expect(balanceFingerprint("200 g Feta", 4)).not.toBe(base);
  });
});

describe("parseRecipeBalance / getBalanceState", () => {
  const stored = { version: BALANCE_VERSION, fingerprint: balanceFingerprint("200 g Feta", 2), ...lentilCurry };

  it("accepts valid facts and detects edited recipes", () => {
    expect(getBalanceState({ balance: stored, ingredients: "200 g Feta", serving_size: 2 }).kind).toBe("ready");
    expect(getBalanceState({ balance: stored, ingredients: "300 g Feta", serving_size: 2 }).kind).toBe("stale");
    expect(getBalanceState({ balance: null, ingredients: "200 g Feta", serving_size: 2 }).kind).toBe("missing");
  });

  it("clamps or drops odd values instead of trusting them", () => {
    const parsed = parseRecipeBalance({
      ...stored,
      salt_g: -5,
      fiber_g: "lots",
      ingredients: [{ name: "X", grams: 1e9, group: "unicorn", nova: 9, whole_grain: "yes", plant: 3 }],
    });
    expect(parsed?.salt_g).toBe(0);
    expect(parsed?.fiber_g).toBe(0);
    expect(parsed?.ingredients[0]).toEqual({
      name: "X",
      grams: 5000,
      group: "other",
      nova: 1,
      whole_grain: false,
      plant: null,
    });
  });

  it("rejects other versions and broken data", () => {
    expect(parseRecipeBalance({ ...stored, version: 99 })).toBeNull();
    expect(parseRecipeBalance("<script>")).toBeNull();
    expect(parseRecipeBalance({ ...stored, energy_kcal: 0 })).toBeNull();
  });
});
