import { describe, expect, it } from "vitest";
import {
  detailsFingerprint,
  detailsMatch,
  formatFraction,
  formatMinutes,
  isNutritionPlausible,
  parseRecipeDetails,
  sumIngredientNutrition,
} from "@/lib/recipe-details";
import { ingredientLines } from "@/lib/ingredient-lines";

describe("ingredientLines", () => {
  it("drops group headers and remembers each line's group", () => {
    expect(ingredientLines("200 g Mehl\n# Für die Soße\n1 Zwiebel\n\n## Topping\nKäse")).toEqual([
      { line: "200 g Mehl", group: null },
      { line: "1 Zwiebel", group: "Für die Soße" },
      { line: "Käse", group: "Topping" },
    ]);
  });
});

describe("parseRecipeDetails", () => {
  it("returns null for anything but an object", () => {
    expect(parseRecipeDetails(null)).toBeNull();
    expect(parseRecipeDetails("x")).toBeNull();
    expect(parseRecipeDetails([])).toBeNull();
  });

  it("keeps valid fields and falls back on broken ones", () => {
    const details = parseRecipeDetails({
      version: 1,
      equipment: ["Topf", 3, " Pfanne "],
      allergens: ["milk", "milk", "unknown"],
      difficulty: "impossible",
      total_minutes: -5,
      ingredients: [{ base_name: "Tomate", section: "produce", kcal: 40 }, "broken"],
      steps: [{ uses: [{ i: 0, fraction: 0.5 }, { i: -1 }, { i: 2, fraction: 7 }] }],
    });

    expect(details).not.toBeNull();
    expect(details!.equipment).toEqual(["Topf", "Pfanne"]);
    expect(details!.allergens).toEqual(["milk"]);
    expect(details!.difficulty).toBeNull();
    expect(details!.total_minutes).toBeNull();
    expect(details!.tips).toEqual([]);
    expect(details!.ingredients[0]).toMatchObject({ base_name: "Tomate", section: "produce", kcal: 40, protein: null });
    expect(details!.ingredients[1]).toMatchObject({ base_name: "", section: "other" });
    expect(details!.steps[0].uses).toEqual([
      { i: 0, fraction: 0.5 },
      { i: 2, fraction: null },
    ]);
  });

  it("reads older versions", () => {
    expect(parseRecipeDetails({ version: 0, tips: ["Tipp"] })?.tips).toEqual(["Tipp"]);
  });
});

describe("detailsFingerprint", () => {
  it("ignores spacing, case, numbering and group headers but not order", () => {
    const base = detailsFingerprint("200 g Mehl\n1 Ei", "Mischen\nBacken");
    expect(detailsFingerprint("# Teig\n200g mehl\n1 Ei", "1. mischen\n2. Backen")).toBe(base);
    expect(detailsFingerprint("1 Ei\n200 g Mehl", "Mischen\nBacken")).not.toBe(base);
    expect(detailsFingerprint("200 g Mehl\n1 Ei", "Mischen")).not.toBe(base);
  });

  it("tells whether details still fit the recipe", () => {
    const recipe = { ingredients: "1 Ei", preparation_steps: "Kochen" };
    const details = parseRecipeDetails({ fingerprint: detailsFingerprint("1 Ei", "Kochen") });
    expect(detailsMatch(details, recipe)).toBe(true);
    expect(detailsMatch(details, { ...recipe, ingredients: "2 Eier" })).toBe(false);
    expect(detailsMatch(parseRecipeDetails({}), recipe)).toBe(false);
  });
});

describe("sumIngredientNutrition", () => {
  it("adds up ingredients and divides by portions", () => {
    const details = parseRecipeDetails({
      ingredients: [
        { kcal: 700, protein: 25, carbs: 140, fat: 3 },
        { kcal: 100, protein: 1, carbs: 2, fat: 11 },
        { kcal: null },
      ],
    })!;
    expect(sumIngredientNutrition(details.ingredients, 2)).toEqual({ calories: 400, protein: 13, carbs: 71, fats: 7 });
  });

  it("is null without any estimate", () => {
    expect(sumIngredientNutrition(parseRecipeDetails({ ingredients: [{}] })!.ingredients, 2)).toBeNull();
  });
});

describe("isNutritionPlausible", () => {
  it("accepts calories that match the macros", () => {
    expect(isNutritionPlausible({ calories: 500, protein: 25, carbs: 60, fats: 18 })).toBe(true);
  });

  it("flags mismatches and unrealistic values", () => {
    expect(isNutritionPlausible({ calories: 900, protein: 25, carbs: 60, fats: 18 })).toBe(false);
    expect(isNutritionPlausible({ calories: 5000, protein: 250, carbs: 600, fats: 180 })).toBe(false);
  });

  it("can't judge incomplete values", () => {
    expect(isNutritionPlausible({ calories: 500, protein: null, carbs: 60, fats: 18 })).toBe(true);
  });
});

describe("formatting", () => {
  it("writes minutes like a recipe", () => {
    expect(formatMinutes(35)).toBe("35 Min.");
    expect(formatMinutes(75, true)).toBe("ca. 1 Std. 15 Min.");
    expect(formatMinutes(120)).toBe("2 Std.");
  });

  it("writes common fractions", () => {
    expect(formatFraction(0.5)).toBe("½");
    expect(formatFraction(0.34)).toBe("⅓");
    expect(formatFraction(0.1)).toBe("10 %");
  });
});
