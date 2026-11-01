import { describe, expect, it } from "vitest";
import {
  findStepTimer,
  formatTimer,
  groupIngredients,
  scaleIngredients,
  scaleQuantity,
  stepIngredientAmounts,
} from "@/lib/recipe-scaling";

describe("scaleQuantity", () => {
  it("scales numbers, fractions and ranges", () => {
    expect(scaleQuantity("200", "g", 1.5)).toBe("300");
    expect(scaleQuantity("½", "", 3)).toBe("1½");
    expect(scaleQuantity("2-3", "Stück", 2)).toBe("4–6");
  });

  it("leaves amounts that aren't numbers alone", () => {
    expect(scaleQuantity("etwas", "", 2)).toBe("etwas");
  });
});

describe("findStepTimer", () => {
  it("finds the first duration and uses the shorter end of a range", () => {
    expect(findStepTimer("15 Minuten köcheln")?.seconds).toBe(900);
    expect(findStepTimer("1-2 Std. ruhen lassen")?.seconds).toBe(3600);
    expect(findStepTimer("Zwiebeln schneiden")).toBeNull();
  });
});

describe("formatTimer", () => {
  it("shows hours only when needed", () => {
    expect(formatTimer(90)).toBe("01:30");
    expect(formatTimer(3725)).toBe("1:02:05");
  });
});

describe("scaleIngredients", () => {
  it("leaves group headers out and keeps each line's group", () => {
    const rows = scaleIngredients("# Teig\n200 g Mehl\n# Soße\n2 Zwiebeln", 2);
    expect(rows.map((row) => [row.amount, row.name, row.group])).toEqual([
      ["400 g", "Mehl", "Teig"],
      ["4", "Zwiebeln", "Soße"],
    ]);
    expect(groupIngredients(rows).map((group) => group.group)).toEqual(["Teig", "Soße"]);
  });
});

describe("stepIngredientAmounts", () => {
  const ingredients = "# Soße\n2 Zwiebeln\n1 Prise Salz\nPfeffer";

  it("uses the step's share of an ingredient", () => {
    const rows = stepIngredientAmounts({ uses: [{ i: 0, fraction: 0.5 }, { i: 2, fraction: null }] }, ingredients, 1);
    expect(rows.map((row) => [row.amount, row.name])).toEqual([
      ["1", "Zwiebeln"],
      ["", "Pfeffer"],
    ]);
  });

  it("scales with the portions and skips unknown lines", () => {
    const rows = stepIngredientAmounts({ uses: [{ i: 0, fraction: 0.5 }, { i: 9, fraction: null }] }, ingredients, 2);
    expect(rows.map((row) => row.amount)).toEqual(["2"]);
  });
});
