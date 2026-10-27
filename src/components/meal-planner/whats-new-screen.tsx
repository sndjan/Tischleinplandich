"use client";

import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChangelogEntry } from "@/types/database";
import { SubPage } from "./sub-page";

const SEEN_STORAGE_KEY = "weekly-meal-planner:changelog-seen";
const SEEN_QUERY_KEY = ["changelog-seen"];

export function useChangelog() {
  return useQuery({
    queryKey: ["changelog"],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<ChangelogEntry[]> => {
      const { data, error } = await createClient()
        .from("changelog")
        .select("*")
        .order("released_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);

      // Until migration 013 runs there is simply nothing new to show.
      if (error) return [];
      return data ?? [];
    },
  });
}

// Latest added entry, also when it was back-dated to an earlier day.
const newestCreatedAt = (entries: ChangelogEntry[] | undefined) =>
  (entries ?? []).reduce((newest, entry) => (entry.created_at > newest ? entry.created_at : newest), "");

const readSeen = () => {
  try {
    return window.localStorage.getItem(SEEN_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
};

/**
 * Whether there are entries the user hasn't opened yet, for the "Neu" marker.
 */
export function useHasUnseenChanges() {
  const { data } = useChangelog();
  // In the query cache so the marker goes away as soon as the page is opened.
  const { data: seen = "" } = useQuery({ queryKey: SEEN_QUERY_KEY, queryFn: readSeen, staleTime: Infinity });
  const newest = newestCreatedAt(data);
  return newest !== "" && newest > seen;
}

const formatDay = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });

export function WhatsNewScreen({ onBack }: { onBack: () => void }) {
  const { data, isPending } = useChangelog();
  const queryClient = useQueryClient();

  const days = useMemo(() => {
    const grouped = new Map<string, ChangelogEntry[]>();
    for (const entry of data ?? []) {
      grouped.set(entry.released_on, [...(grouped.get(entry.released_on) ?? []), entry]);
    }
    return [...grouped.entries()];
  }, [data]);

  // Opening the page counts as having seen everything on it.
  useEffect(() => {
    const newest = newestCreatedAt(data);
    if (!newest) return;
    queryClient.setQueryData(SEEN_QUERY_KEY, newest);
    try {
      window.localStorage.setItem(SEEN_STORAGE_KEY, newest);
    } catch {
      // Storage unavailable; the marker only comes back after a reload.
    }
  }, [data, queryClient]);

  return (
    <SubPage title="Was ist neu?" tone="muted" onBack={onBack}>
      {isPending ? (
        <div className="space-y-2" aria-busy="true" aria-label="Lädt">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-24 w-full rounded-[18px]" />
        </div>
      ) : days.length === 0 ? (
        <p className="py-10 text-center text-sm text-brand-secondary">Noch keine Einträge</p>
      ) : (
        days.map(([day, entries]) => (
          <section key={day} className="space-y-2">
            <h2 className="px-1 text-xs font-bold uppercase tracking-[0.06em] text-brand-secondary">{formatDay(day)}</h2>
            <ul className="overflow-hidden rounded-[18px] bg-white ring-1 ring-brand-card-border">
              {entries.map((entry) => (
                <li key={entry.id} className="flex gap-3 border-b border-brand-divider px-3.5 py-3 last:border-b-0">
                  <span className="mt-[7px] size-2 shrink-0 rounded-full bg-brand-accent" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-brand-ink">{entry.title}</p>
                    {entry.description && (
                      <p className="text-[13px] leading-relaxed text-brand-secondary">{entry.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </SubPage>
  );
}
