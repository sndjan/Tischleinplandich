import { describe, expect, it } from "vitest";
import { generateShoppingListFromPlannedMeals, isBasicIngredient, parseIngredient } from "@/lib/shopping-list";

describe("parseIngredient", () => {
  it("reads quantity, unit and name", () => {
    expect(parseIngredient("200g Mehl")).toMatchObject({ ingredient: "mehl", quantity: 200, unit: "g" });
    expect(parseIngredient("2 EL Olivenöl")).toMatchObject({ ingredient: "olivenöl", quantity: 2, unit: "tbsp" });
    expect(parseIngredient("1/2 Zwiebel")).toMatchObject({ ingredient: "zwiebel", quantity: 0.5, unit: "" });
  });
});

describe("generateShoppingListFromPlannedMeals", () => {
  it("scales by planned servings and adds up compatible units", () => {
    const list = generateShoppingListFromPlannedMeals(
      [
        { recipe_id: "a", serving_size: 2 },
        { recipe_id: "b", serving_size: 1 },
      ],
      [
        { id: "a", name: "A", ingredients: "200 g Mehl\n1 Zwiebel", serving_size: 1 },
        { id: "b", name: "B", ingredients: "0,9 kg Mehl", serving_size: 1 },
      ],
    );

    expect(list).toEqual([
      expect.objectContaining({ ingredient: "mehl", quantity: 1.3, unit: "kg", sources: ["A", "B"] }),
      expect.objectContaining({ ingredient: "zwiebel", quantity: 2, unit: "", sources: ["A"] }),
    ]);
  });

  it("is empty without planned meals", () => {
    expect(generateShoppingListFromPlannedMeals([], [])).toEqual([]);
  });

  it("leaves out excluded recipes", () => {
    const list = generateShoppingListFromPlannedMeals(
      [
        { recipe_id: "a", serving_size: 1 },
        { recipe_id: "b", serving_size: 1 },
      ],
      [
        { id: "a", name: "A", ingredients: "1 Zwiebel", serving_size: 1 },
        { id: "b", name: "B", ingredients: "200 g Reis", serving_size: 1 },
      ],
      { excludedRecipeIds: ["b"] },
    );

    expect(list).toEqual([expect.objectContaining({ ingredient: "zwiebel", sources: ["A"] })]);
  });

  it("adds ingredients put on the list without planning", () => {
    const list = generateShoppingListFromPlannedMeals(
      [{ recipe_id: "a", serving_size: 1 }],
      [{ id: "a", name: "A", ingredients: "1 Zwiebel", serving_size: 1 }],
      { extras: [{ id: "x", recipeName: "C", lines: ["1 Zwiebel", "100 g Feta"], multiplier: 2 }] },
    );

    expect(list).toEqual([
      expect.objectContaining({ ingredient: "feta", quantity: 200, unit: "g", sources: ["C"] }),
      expect.objectContaining({ ingredient: "zwiebel", quantity: 3, sources: ["C", "A"] }),
    ]);
  });
});

describe("isBasicIngredient", () => {
  it("matches staples by their trailing words only", () => {
    expect(isBasicIngredient("getrockneter Oregano", ["oregano"])).toBe(true);
    expect(isBasicIngredient("Salz zum Abschmecken", ["salz"])).toBe(true);
    expect(isBasicIngredient("Oregano-Pesto", ["oregano"])).toBe(false);
  });
});
