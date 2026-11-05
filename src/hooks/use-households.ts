"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { householdErrorMessage, householdLabel, sharedHouseholds } from "@/lib/households";
import { queryKeys, useHouseholdsQuery, useUserId } from "./use-planner-data";

// Shared households seen last time, so the app can say when one is gone.
const KNOWN_STORAGE_KEY = "weekly-meal-planner:known-households";

type KnownHousehold = { id: string; name: string };

function readKnown(): KnownHousehold[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(KNOWN_STORAGE_KEY) ?? "[]");
    return Array.isArray(stored)
      ? stored.filter((entry) => typeof entry?.id === "string" && typeof entry?.name === "string")
      : [];
  } catch {
    return [];
  }
}

function writeKnown(known: KnownHousehold[]) {
  try {
    window.localStorage.setItem(KNOWN_STORAGE_KEY, JSON.stringify(known));
  } catch {
    // Storage unavailable; the notice is simply skipped.
  }
}

// Leaving or deleting yourself needs no notice.
function forget(householdId: string) {
  writeKnown(readKnown().filter((entry) => entry.id !== householdId));
}

/**
 * Says once when the user is no longer in a shared household because it was
 * deleted or they were removed. Nothing is pushed or mailed; this note on the
 * next visit is all they get.
 */
export function useHouseholdGoneNotice() {
  const { data } = useHouseholdsQuery();

  useEffect(() => {
    if (!data?.ready) return;
    const current = sharedHouseholds(data).map((household) => ({ id: household.id, name: householdLabel(household) }));
    const currentIds = new Set(current.map((household) => household.id));

    for (const gone of readKnown().filter((entry) => !currentIds.has(entry.id))) {
      toast(`Du bist nicht mehr im Haushalt „${gone.name}“.`, { duration: 6000 });
    }
    writeKnown(current);
  }, [data]);
}

type RpcResult<T> = { ok: true; value: T } | { ok: false };

/**
 * Household actions from the profile. Each shows its own error and refreshes
 * the households, plans and member recipes afterwards.
 */
export function useHouseholdActions() {
  const queryClient = useQueryClient();
  const userId = useUserId();

  const refresh = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.households(userId ?? "") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.allWeeks(userId ?? "") }),
        queryClient.invalidateQueries({ queryKey: ["household-recipes"] }),
      ]),
    [queryClient, userId],
  );

  const run = useCallback(
    async <T>(call: () => PromiseLike<{ data: unknown; error: unknown }>): Promise<RpcResult<T>> => {
      const { data, error } = await call();
      if (error) {
        console.error(error);
        toast.error(householdErrorMessage(error));
        return { ok: false };
      }
      await refresh();
      return { ok: true, value: data as T };
    },
    [refresh],
  );

  return useMemo(() => {
    const supabase = createClient();

    return {
      setActive: (householdId: string | null) =>
        run<null>(() => supabase.rpc("set_active_household", { p_household_id: householdId })),
      create: (name: string) => run<string>(() => supabase.rpc("create_household", { p_name: name })),
      rename: (householdId: string, name: string) =>
        run<null>(() => supabase.rpc("rename_household", { p_household_id: householdId, p_name: name })),
      setServings: (householdId: string, servings: number | null) =>
        run<null>(() =>
          supabase.rpc("set_household_servings", { p_household_id: householdId, p_servings: servings }),
        ),
      removeMember: (householdId: string, memberId: string) =>
        run<null>(() =>
          supabase.rpc("remove_household_member", { p_household_id: householdId, p_user_id: memberId }),
        ),
      leave: async (householdId: string) => {
        const result = await run<null>(() => supabase.rpc("leave_household", { p_household_id: householdId }));
        if (result.ok) forget(householdId);
        return result;
      },
      remove: async (householdId: string) => {
        const result = await run<null>(() => supabase.rpc("delete_household", { p_household_id: householdId }));
        if (result.ok) forget(householdId);
        return result;
      },
      // Not followed by a refresh: the link isn't part of the cached data.
      getInvite: async (householdId: string, reset = false) => {
        const { data, error } = await supabase.rpc("get_household_invite", {
          p_household_id: householdId,
          p_reset: reset,
        });
        const invite = data as { token?: unknown; expires_at?: unknown } | null;
        if (error || typeof invite?.token !== "string") {
          console.error(error);
          toast.error(householdErrorMessage(error));
          return null;
        }
        return { token: invite.token, expiresAt: typeof invite.expires_at === "string" ? invite.expires_at : null };
      },
    };
  }, [run]);
}
