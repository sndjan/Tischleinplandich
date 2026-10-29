"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { useUserId } from "@/hooks/use-planner-data";
import { formatRewardDays, rewardThanks, totalRewardDays, unseenRewards } from "@/lib/feedback-rewards";
import type { FeedbackReward } from "@/types/database";

const SEEN_STORAGE_KEY = "weekly-meal-planner:feedback-rewards-seen";

/**
 * Premium days the user got for feedback. Empty until migration 017 exists.
 */
export function useFeedbackRewards() {
  const userId = useUserId();

  return useQuery({
    queryKey: ["feedback-rewards", userId ?? ""],
    enabled: Boolean(userId),
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<FeedbackReward[]> => {
      const { data, error } = await createClient()
        .from("feedback_rewards")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });

      if (error) return [];
      return data ?? [];
    },
  });
}

const readSeen = (): string[] => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(SEEN_STORAGE_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
};

/**
 * Thanks the user once per new reward, so they learn their feedback made it in.
 */
export function useRewardThanks() {
  const { data } = useFeedbackRewards();

  useEffect(() => {
    if (!data || data.length === 0) return;
    const seen = readSeen();
    const fresh = unseenRewards(data, seen);
    if (fresh.length === 0) return;

    for (const reward of fresh) toast(rewardThanks(reward), { icon: "🎁", duration: 8000 });
    try {
      window.localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify([...seen, ...fresh.map((reward) => reward.id)]));
    } catch {
      // Storage unavailable; the note shows again after a reload.
    }
  }, [data]);
}

export function RewardCreditCard({ rewards }: { rewards: FeedbackReward[] }) {
  const total = totalRewardDays(rewards);

  return (
    <section
      aria-label="Premium-Guthaben"
      className="flex items-center gap-3.5 rounded-[18px] bg-white px-3.5 py-3 ring-1 ring-brand-card-border"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#fff4e0] text-lg" aria-hidden="true">
        🎁
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-brand-ink">Premium-Guthaben</span>
        <span className="block text-[13px] text-brand-secondary">
          Für {rewards.length === 1 ? "umgesetztes Feedback" : `${rewards.length}× umgesetztes Feedback`} · gilt ab
          dem Premium-Start
        </span>
      </span>
      <span className="shrink-0 text-[15px] font-bold tabular-nums text-brand-ink">{formatRewardDays(total)}</span>
    </section>
  );
}
