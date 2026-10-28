import { expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/next-path";

it("only allows paths inside the app", () => {
  expect(safeNextPath("/r/abc")).toBe("/r/abc");
  expect(safeNextPath("https://evil.example")).toBe("/meal-planner");
  expect(safeNextPath("//evil.example")).toBe("/meal-planner");
  expect(safeNextPath("/\\evil.example")).toBe("/meal-planner");
  expect(safeNextPath(null)).toBe("/meal-planner");
});
