import { expect, it } from "vitest";
import { getMealRecipe } from "@/lib/planned-meal";
import type { Recipe } from "@/types/database";

const recipes = new Map([["r1", { id: "r1", name: "Dal" } as Recipe]]);

it("returns the planned recipe", () => {
  expect(getMealRecipe({ id: "m1", recipe_id: "r1" }, recipes)).toEqual({ recipe: recipes.get("r1"), isRecipe: true });
});

it("skips meals whose recipe is not loaded", () => {
  expect(getMealRecipe({ id: "m1", recipe_id: "gone" }, recipes)).toBeUndefined();
});

it("stands in for a meal without a recipe", () => {
  const result = getMealRecipe({ id: "m2", recipe_id: null, label: "Pizza beim Italiener", calories: 900 }, recipes);
  expect(result?.isRecipe).toBe(false);
  expect(result?.recipe).toMatchObject({ name: "Pizza beim Italiener", calories: 900, ingredients: "" });
});

it("ignores rows with neither recipe nor label", () => {
  expect(getMealRecipe({ id: "m3", recipe_id: null }, recipes)).toBeUndefined();
});
