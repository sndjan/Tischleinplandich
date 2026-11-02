import { describe, expect, it } from "vitest";
import {
  generateShoppingListFromPlannedMeals,
  isBasicIngredient,
  parseIngredient,
  shoppingMergeName,
} from "@/lib/shopping-list";
import { formatShoppingItemAmount } from "@/lib/shopping-sections";

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

describe("ingredient groups", () => {
  it("leaves group headers off the shopping list", () => {
    const items = generateShoppingListFromPlannedMeals(
      [{ recipe_id: "r1", serving_size: 1 }],
      [{ id: "r1", name: "Pizza", ingredients: "# Teig\n200 g Mehl\n# Belag\n100 g Käse", serving_size: 1 }],
    );
    expect(items.map((item) => item.ingredient).sort()).toEqual(["käse", "mehl"]);
  });
});

describe("merging the same ingredient", () => {
  const listFor = (...ingredients: string[]) =>
    generateShoppingListFromPlannedMeals(
      ingredients.map((_, index) => ({ recipe_id: String(index), serving_size: 1 })),
      ingredients.map((text, index) => ({ id: String(index), name: `R${index}`, ingredients: text, serving_size: 1 })),
    );

  it("treats singular and plural as one item", () => {
    for (const [one, other] of [
      ["Zwiebel", "Zwiebeln"],
      ["Tomate", "Tomaten"],
      ["Kartoffel", "Kartoffeln"],
      ["Champignon", "Champignons"],
      ["Ei", "Eier"],
    ]) {
      expect(shoppingMergeName(one)).toBe(shoppingMergeName(other));
    }
    expect(listFor("1 Zwiebel", "2 Zwiebeln")).toEqual([
      expect.objectContaining({ quantity: 3, unit: "", sources: ["R0", "R1"] }),
    ]);
  });

  it("ignores notes in brackets and after a comma", () => {
    expect(listFor("1 Bund Petersilie (frisch)", "1 Bund Petersilie")).toHaveLength(1);
    expect(listFor("1 Zwiebel, fein gewürfelt", "1 Zwiebel")).toEqual([
      expect.objectContaining({ quantity: 2 }),
    ]);
  });

  it("keeps different things apart", () => {
    expect(shoppingMergeName("Lauchzwiebeln")).not.toBe(shoppingMergeName("Zwiebeln"));
    expect(listFor("1 Zwiebel", "1 Knoblauch")).toHaveLength(2);
  });

  it("shows amounts in units that don't convert on one row", () => {
    const list = listFor("2 Eier", "100 g Ei");
    expect(list).toHaveLength(1);
    expect(formatShoppingItemAmount(list[0]!)).toBe("2 + 100 g");
    expect(list[0]!.sources).toEqual(["R0", "R1"]);
  });
});
