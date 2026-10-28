import { describe, expect, it } from "vitest";
import { findStepTimer, formatTimer, scaleQuantity } from "@/lib/recipe-scaling";

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
