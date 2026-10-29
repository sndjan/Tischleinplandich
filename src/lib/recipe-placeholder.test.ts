import { expect, it } from "vitest";
import { getRecipePlaceholder } from "@/lib/recipe-placeholder";

it.each([
  ["Spaghetti Bolognese", "🍝"],
  ["Nudelsalat", "🍝"],
  ["Griechischer Salat", "🥗"],
  ["Rote Linsen Dal", "🍛"],
  ["Kürbissuppe", "🍲"],
  ["Overnight Oats mit Joghurt", "🥣"],
  ["Weizenbrötchen", "🥪"],
  ["Omas Spezialität", "🍽️"],
])("%s → %s", (name, emoji) => {
  expect(getRecipePlaceholder(name).emoji).toBe(emoji);
});

it("keeps the same color for the same name", () => {
  expect(getRecipePlaceholder("Linsen Dal").hue).toBe(getRecipePlaceholder("linsen dal").hue);
  expect(getRecipePlaceholder("Linsen Dal").hue).toBeGreaterThanOrEqual(0);
  expect(getRecipePlaceholder("Linsen Dal").hue).toBeLessThan(360);
});
