import { expect, it } from "vitest";
import { orderShoppingSections, SHOPPING_SECTIONS } from "@/lib/shopping-sections";

const ids = (order?: string[]) => orderShoppingSections(order).map((section) => section.id);

it("keeps the default order without a custom one", () => {
  expect(ids()).toEqual(SHOPPING_SECTIONS.map((section) => section.id));
});

it("puts the chosen sections first and the rest after in default order", () => {
  const result = ids(["dry", "produce"]);
  expect(result.slice(0, 3)).toEqual(["dry", "produce", "bakery"]);
  expect(result).toHaveLength(SHOPPING_SECTIONS.length);
});

it("ignores unknown and repeated ids", () => {
  expect(ids(["gone", "dry", "dry"])[0]).toBe("dry");
  expect(ids(["gone", "dry", "dry"])).toHaveLength(SHOPPING_SECTIONS.length);
});
