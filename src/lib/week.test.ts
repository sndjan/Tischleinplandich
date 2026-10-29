import { describe, expect, it } from "vitest";
import { getDayIndex, getWeekDates, getWeekKey, getWeekLabel, getWeekMonday } from "@/lib/week";

// How week_start_date was computed before weeks could be switched.
function legacyWeekKey(today: Date): string {
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  weekStart.setHours(0, 0, 0, 0);
  return weekStart.toISOString().split("T")[0];
}

describe("getWeekMonday", () => {
  it("returns the Monday of the week, Sunday included", () => {
    for (let day = 26; day <= 31; day++) {
      expect(getWeekMonday(0, new Date(2026, 9, day, 15)).getDate()).toBe(26);
    }
    expect(getWeekMonday(0, new Date(2026, 10, 1, 15)).getDate()).toBe(26);
    expect(getWeekMonday(0, new Date(2026, 10, 2, 15)).getDate()).toBe(2);
  });

  it("moves by whole weeks", () => {
    const now = new Date(2026, 9, 29, 9);
    expect(getWeekMonday(1, now)).toEqual(new Date(2026, 10, 2));
    expect(getWeekMonday(-1, now)).toEqual(new Date(2026, 9, 19));
  });
});

describe("getWeekKey", () => {
  it("matches the stored key for Monday to Saturday", () => {
    for (let day = 26; day <= 31; day++) {
      const today = new Date(2026, 9, day, 12);
      expect(getWeekKey(getWeekMonday(0, today))).toBe(legacyWeekKey(today));
    }
  });

  it("keeps Sunday in the week it ends", () => {
    const saturday = new Date(2026, 9, 31, 12);
    const sunday = new Date(2026, 10, 1, 12);
    expect(getWeekKey(getWeekMonday(0, sunday))).toBe(legacyWeekKey(saturday));
  });
});

it("getWeekDates lists Monday to Sunday across a month end", () => {
  expect(getWeekDates(new Date(2026, 9, 26))).toEqual([26, 27, 28, 29, 30, 31, 1]);
});

it("getDayIndex counts from Monday", () => {
  expect(getDayIndex(new Date(2026, 9, 26))).toBe(0);
  expect(getDayIndex(new Date(2026, 10, 1))).toBe(6);
});

it("getWeekLabel names nearby weeks", () => {
  const monday = new Date(2026, 10, 9);
  expect(getWeekLabel(0, monday)).toBe("Diese Woche");
  expect(getWeekLabel(1, monday)).toBe("Nächste Woche");
  expect(getWeekLabel(-1, monday)).toBe("Letzte Woche");
  expect(getWeekLabel(2, monday)).toMatch(/^9\. Nov/);
});
