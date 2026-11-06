import { describe, expect, it } from "vitest";
import {
  applyShoppingOps,
  cleanCustomItem,
  collectLegacyImport,
  EMPTY_SHOPPING_STATE,
  legacyKeys,
  readLegacyWeek,
  type ShoppingState,
} from "./shopping-state";

function memoryStorage(entries: Record<string, unknown>) {
  const data = new Map(Object.entries(entries).map(([key, value]) => [key, JSON.stringify(value)]));
  const keys = [...data.keys()];
  return {
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => keys[index] ?? null,
    get length() {
      return keys.length;
    },
  };
}

const base: ShoppingState = {
  ...EMPTY_SHOPPING_STATE,
  checked: ["zwiebel|"],
  customItems: [{ id: "c1", label: "Klopapier" }],
  extras: [{ id: "e1", recipeName: "Dal", lines: ["200 g Linsen"], multiplier: 1 }],
};

describe("applyShoppingOps", () => {
  it("checks and unchecks without duplicates", () => {
    const checked = applyShoppingOps(base, [
      { type: "mark", kind: "checked", key: "milch|l", on: true },
      { type: "mark", kind: "checked", key: "milch|l", on: true },
      { type: "mark", kind: "checked", key: "zwiebel|", on: false },
    ]);
    expect(checked.checked).toEqual(["milch|l"]);
  });

  it("keeps removed items and left-off recipes apart from checks", () => {
    const next = applyShoppingOps(base, [
      { type: "mark", kind: "removed", key: "salz|", on: true },
      { type: "mark", kind: "excluded_recipe", key: "r1", on: true },
    ]);
    expect(next.removed).toEqual(["salz|"]);
    expect(next.excludedRecipeIds).toEqual(["r1"]);
    expect(next.checked).toEqual(base.checked);
  });

  it("adds and removes items by id", () => {
    const next = applyShoppingOps(base, [
      { type: "add-custom", item: { id: "c2", label: "Kaffee", amount: "500 g" } },
      { type: "add-custom", item: { id: "c2", label: "Kaffee" } },
      { type: "remove-item", id: "c1" },
      { type: "remove-item", id: "e1" },
    ]);
    expect(next.customItems).toEqual([{ id: "c2", label: "Kaffee", amount: "500 g" }]);
    expect(next.extras).toEqual([]);
  });

  it("changes only the given settings", () => {
    const next = applyShoppingOps(base, [{ type: "settings", sectionOrder: ["dairy"] }]);
    expect(next.hideBasics).toBe(true);
    expect(next.sectionOrder).toEqual(["dairy"]);
  });

  it("returns the same state when nothing changes", () => {
    expect(applyShoppingOps(base, [])).toBe(base);
    expect(applyShoppingOps(base, [{ type: "mark", kind: "checked", key: "zwiebel|", on: true }])).toBe(base);
  });
});

describe("cleanCustomItem", () => {
  it("trims, shortens and drops empty items", () => {
    expect(cleanCustomItem({ id: "a", label: "  Brot ", amount: " " })).toEqual({ id: "a", label: "Brot" });
    expect(cleanCustomItem({ id: "a", label: "x".repeat(250) })?.label).toHaveLength(200);
    expect(cleanCustomItem({ id: "a", label: "   " })).toBeNull();
  });
});

describe("legacy browser storage", () => {
  const storage = memoryStorage({
    [legacyKeys.checked("2026-11-02")]: ["zwiebel|", 4],
    [legacyKeys.removed("2026-11-02")]: ["salz|"],
    [legacyKeys.week("2026-11-02")]: {
      excludedRecipeIds: ["r1"],
      extras: [{ id: "e1", recipeName: "Dal", lines: ["200 g Linsen"], multiplier: 2 }, { id: "bad" }],
    },
    [legacyKeys.checked("2026-09-07")]: ["alt|"],
    [legacyKeys.unscopedChecked]: ["sehr-alt|"],
    [legacyKeys.custom]: [{ id: "c1", label: "Klopapier" }, { label: "ohne id" }],
    [legacyKeys.hideBasics]: false,
    [legacyKeys.sectionOrder]: ["dairy", "produce"],
    "something-else": ["x"],
  });

  it("reads one week", () => {
    expect(readLegacyWeek(storage, "2026-11-02", true)).toEqual({
      checked: ["zwiebel|"],
      removed: ["salz|"],
      excludedRecipeIds: ["r1"],
      extras: [{ id: "e1", recipeName: "Dal", lines: ["200 g Linsen"], multiplier: 2 }],
      customItems: [{ id: "c1", label: "Klopapier" }],
      hideBasics: false,
      sectionOrder: ["dairy", "produce"],
    });
  });

  it("falls back to the old unscoped checks for the current week only", () => {
    expect(readLegacyWeek(storage, "2026-11-09", true).checked).toEqual(["sehr-alt|"]);
    expect(readLegacyWeek(storage, "2026-11-09", false).checked).toEqual([]);
  });

  it("collects recent weeks and general changes for the import", () => {
    const result = collectLegacyImport(storage, "2026-11-02", "2026-10-05");
    expect(Object.keys(result.weeks)).toEqual(["2026-11-02"]);
    expect(result.weeks["2026-11-02"]).toEqual([
      { type: "mark", kind: "checked", key: "zwiebel|", on: true },
      { type: "mark", kind: "removed", key: "salz|", on: true },
      { type: "mark", kind: "excluded_recipe", key: "r1", on: true },
      { type: "add-extra", extra: { id: "e1", recipeName: "Dal", lines: ["200 g Linsen"], multiplier: 2 } },
    ]);
    expect(result.general).toEqual([
      { type: "add-custom", item: { id: "c1", label: "Klopapier" } },
      { type: "settings", hideBasics: false, sectionOrder: ["dairy", "produce"] },
    ]);
  });

  it("imports nothing from an empty browser", () => {
    expect(collectLegacyImport(memoryStorage({}), "2026-11-02", "2026-10-05")).toEqual({ weeks: {}, general: [] });
  });
});
