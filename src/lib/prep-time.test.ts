import { expect, it } from "vitest";
import { parsePrepMinutes } from "@/lib/prep-time";

it.each([
  ["30 Min.", 30],
  ["1 Std. 15 Min.", 75],
  ["1,5 Stunden", 90],
  ["PT1H20M", 80],
  ["20–25 Min.", 25],
  ["15 Min. Zubereitung (35 Min. gesamt)", 35],
  ["lecker", null],
  [null, null],
])("parsePrepMinutes(%j) = %j", (input, minutes) => {
  expect(parsePrepMinutes(input)).toBe(minutes);
});
