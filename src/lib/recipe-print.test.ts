import { expect, it } from "vitest";
import { recipesToPrintHtml } from "@/lib/recipe-print";
import type { Recipe } from "@/types/database";

const recipe = (overrides: Partial<Recipe>) =>
  ({
    id: "r1",
    name: "Linsen Dal",
    ingredients: "200 g rote Linsen\n1 Zwiebel",
    preparation_steps: "1. Zwiebel anbraten\n2. Linsen kochen",
    serving_size: 2,
    image_url: null,
    source_url: null,
    ...overrides,
  }) as Recipe;

it("lists ingredients and numbered steps without their numbers", () => {
  const html = recipesToPrintHtml([recipe({})], { r1: ["Vegan"] });
  expect(html).toContain("<li>200 g rote Linsen</li>");
  expect(html).toContain("<li>Zwiebel anbraten</li>");
  expect(html).toContain("2 Portionen");
  expect(html).toContain("Vegan");
});

it("escapes text from the recipe", () => {
  const html = recipesToPrintHtml([recipe({ name: "<script>alert(1)</script>" })], {});
  expect(html).not.toContain("<script>");
  expect(html).toContain("&#60;script&#62;");
});

it("only uses web links for images", () => {
  expect(recipesToPrintHtml([recipe({ image_url: "javascript:alert(1)" })], {})).not.toContain("<img");
  expect(recipesToPrintHtml([recipe({ image_url: "https://example.com/a.jpg" })], {})).toContain(
    '<img src="https://example.com/a.jpg"',
  );
});
