import { expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/next-path";

it("only allows paths inside the app", () => {
  expect(safeNextPath("/r/abc")).toBe("/r/abc");
  expect(safeNextPath("https://evil.example")).toBe("/meal-planner");
  expect(safeNextPath("//evil.example")).toBe("/meal-planner");
  expect(safeNextPath("/\\evil.example")).toBe("/meal-planner");
  expect(safeNextPath(null)).toBe("/meal-planner");
});

it("rejects paths that a URL parser would turn into another site", () => {
  for (const value of ["/\t/evil.example", "/\n/evil.example", "/\r/evil.example", "/\t\\evil.example", "/a\\b"]) {
    expect(safeNextPath(value)).toBe("/meal-planner");
  }
  expect(safeNextPath("/einladen/abc?x=1#y")).toBe("/einladen/abc?x=1#y");
});
