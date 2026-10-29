import type { FeedbackReward } from "@/types/database";

// Mirrors grant_feedback_reward in migration 017; shown in the conditions.
export const REWARD_DAYS = { small: 7, medium: 14, large: 30 } as const;
export const YEARLY_REWARD_LIMIT_DAYS = 90;

/**
 * "1 Woche", "2 Wochen", "1 Monat", "3 Monate", otherwise days. Months are
 * counted as 30 days, the same as a "large" reward.
 */
export function formatRewardDays(days: number) {
  if (days > 0 && days % 30 === 0) return days === 30 ? "1 Monat" : `${days / 30} Monate`;
  if (days > 0 && days % 7 === 0) return days === 7 ? "1 Woche" : `${days / 7} Wochen`;
  return days === 1 ? "1 Tag" : `${days} Tage`;
}

export const totalRewardDays = (rewards: Pick<FeedbackReward, "days">[]) =>
  rewards.reduce((total, reward) => total + reward.days, 0);

/**
 * Rewards the user hasn't been thanked for yet, oldest first so several
 * thank-you notes come in the order they were earned.
 */
export function unseenRewards<T extends Pick<FeedbackReward, "id" | "created_at">>(rewards: T[], seenIds: string[]) {
  const seen = new Set(seenIds);
  return rewards
    .filter((reward) => !seen.has(reward.id))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function rewardThanks(reward: Pick<FeedbackReward, "category" | "days" | "note">) {
  const gift = `dafür bekommst du ${formatRewardDays(reward.days)} Premium geschenkt.`;
  const note = reward.note?.trim();
  if (reward.category === "bug") {
    return note
      ? `Danke! Der Fehler „${note}“ ist behoben – ${gift}`
      : `Danke! Der Fehler, den du gemeldet hast, ist behoben – ${gift}`;
  }
  if (reward.category === "idea") {
    return note ? `Danke! „${note}“ ist jetzt in der App – ${gift}` : `Danke! Deine Idee ist jetzt in der App – ${gift}`;
  }
  return note ? `Danke für dein Feedback zu „${note}“ – ${gift}` : `Danke für dein Feedback – ${gift}`;
}
