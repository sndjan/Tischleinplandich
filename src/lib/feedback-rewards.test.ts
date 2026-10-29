import { describe, expect, it } from "vitest";
import { formatRewardDays, rewardThanks, totalRewardDays, unseenRewards } from "@/lib/feedback-rewards";

it.each([
  [7, "1 Woche"],
  [14, "2 Wochen"],
  [30, "1 Monat"],
  [90, "3 Monate"],
  [44, "44 Tage"],
  [1, "1 Tag"],
  [0, "0 Tage"],
])("formatRewardDays(%j) = %j", (days, label) => {
  expect(formatRewardDays(days)).toBe(label);
});

it("adds up reward days", () => {
  expect(totalRewardDays([{ days: 7 }, { days: 30 }, { days: 14 }])).toBe(51);
  expect(totalRewardDays([])).toBe(0);
});

describe("unseenRewards", () => {
  const rewards = [
    { id: "b", created_at: "2026-10-20T10:00:00Z" },
    { id: "a", created_at: "2026-10-01T10:00:00Z" },
    { id: "c", created_at: "2026-10-28T10:00:00Z" },
  ];

  it("leaves out seen rewards and sorts the rest oldest first", () => {
    expect(unseenRewards(rewards, ["b"]).map((reward) => reward.id)).toEqual(["a", "c"]);
  });

  it("returns nothing when everything was seen", () => {
    expect(unseenRewards(rewards, ["a", "b", "c"])).toEqual([]);
  });
});

describe("rewardThanks", () => {
  it("thanks for an idea, with and without a note", () => {
    expect(rewardThanks({ category: "idea", days: 30, note: "Gemeinsame Rezepte" })).toBe(
      "Danke! „Gemeinsame Rezepte“ ist jetzt in der App – dafür bekommst du 1 Monat Premium geschenkt.",
    );
    expect(rewardThanks({ category: "idea", days: 7, note: null })).toBe(
      "Danke! Deine Idee ist jetzt in der App – dafür bekommst du 1 Woche Premium geschenkt.",
    );
  });

  it("thanks for a bug", () => {
    expect(rewardThanks({ category: "bug", days: 14, note: "  " })).toBe(
      "Danke! Der Fehler, den du gemeldet hast, ist behoben – dafür bekommst du 2 Wochen Premium geschenkt.",
    );
  });

  it("uses the days actually granted when the yearly limit cut them", () => {
    expect(rewardThanks({ category: "other", days: 16, note: null })).toBe(
      "Danke für dein Feedback – dafür bekommst du 16 Tage Premium geschenkt.",
    );
  });
});
