"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import type { ShoppingExtra } from "@/lib/shopping-list";
import {
  applyShoppingOps,
  cleanCustomItem,
  collectLegacyImport,
  EMPTY_SHOPPING_STATE,
  ITEM_KEY_MAX,
  legacyKeys,
  readLegacyWeek,
  type ShoppingMarkKind,
  type ShoppingOp,
  type ShoppingState,
} from "@/lib/shopping-state";
import { getWeekKey, getWeekMonday } from "@/lib/week";
import { isMissingHouseholdsError, type HouseholdsData } from "@/lib/households";
import { useSelectedWeek } from "./use-selected-week";
import { queryKeys, useActiveHousehold, useWeekScope } from "./use-planner-data";

/**
 * The shopping list's own state for the selected week, and the one way to
 * change it. Backed by the household's tables (migration 031) and shared live;
 * before that migration, and in the landing page demo, by this browser alone.
 */
export type ShoppingStore = {
  state: ShoppingState;
  apply: (op: ShoppingOp) => void;
  // True when the list is shared through the database.
  shared: boolean;
  // Changes made offline that are still waiting to be sent.
  pending: number;
  // Only the browser-only list forgets checks of rows that left it. A shared
  // list keeps them: another member's view may still be loading those rows.
  forgetChecks?: (validKeys: Set<string>) => void;
};

// Database ------------------------------------------------------------------

type ServerShopping = {
  state: Omit<ShoppingState, "hideBasics" | "sectionOrder">;
  // Row ids, to tell whether a Realtime delete (which only carries the id) matters here.
  ids: string[];
};

type ItemRow = {
  id: string;
  week_start_date: string | null;
  kind: "custom" | "extra";
  label: string;
  amount: string | null;
  lines: unknown;
  multiplier: number | null;
};

const MARK_FIELD: Record<ShoppingMarkKind, "checked" | "removed" | "excludedRecipeIds"> = {
  checked: "checked",
  removed: "removed",
  excluded_recipe: "excludedRecipeIds",
};

/**
 * The household's list for a week, or null while migration 031 is missing.
 */
async function fetchShopping(householdId: string, weekKey: string): Promise<ServerShopping | null> {
  const supabase = createClient();
  const [marks, items] = await Promise.all([
    supabase.from("shopping_marks").select("id, kind, item_key").eq("household_id", householdId).eq("week_start_date", weekKey),
    supabase
      .from("shopping_items")
      .select("id, week_start_date, kind, label, amount, lines, multiplier")
      .eq("household_id", householdId)
      .or(`week_start_date.is.null,week_start_date.eq.${weekKey}`)
      .order("created_at"),
  ]);

  if (isMissingHouseholdsError(marks.error) || isMissingHouseholdsError(items.error)) return null;
  if (marks.error) throw marks.error;
  if (items.error) throw items.error;

  const state: ServerShopping["state"] = { checked: [], removed: [], excludedRecipeIds: [], customItems: [], extras: [] };
  const ids: string[] = [];

  for (const mark of marks.data ?? []) {
    ids.push(mark.id);
    state[MARK_FIELD[mark.kind as ShoppingMarkKind]]?.push(mark.item_key);
  }

  for (const item of (items.data ?? []) as ItemRow[]) {
    ids.push(item.id);
    if (item.kind === "custom") {
      state.customItems.push({ id: item.id, label: item.label, ...(item.amount && { amount: item.amount }) });
    } else {
      const lines = Array.isArray(item.lines) ? item.lines.filter((line): line is string => typeof line === "string") : [];
      state.extras.push({ id: item.id, recipeName: item.label, lines, multiplier: Number(item.multiplier) || 1 });
    }
  }

  return { state, ids };
}

// Changes waiting to be sent, kept in the browser so they survive going offline
// and closing the app. Sent strictly in order: a check followed by an uncheck
// must arrive in that order.
type OutboxEntry = {
  id: string;
  userId: string;
  householdId: string;
  // The week a mark or extra belongs to; null for custom items and settings.
  weekKey: string | null;
  op: ShoppingOp;
};

const OUTBOX_STORAGE_KEY = "weekly-meal-planner:shopping-outbox";
const RETRY_MS = 15_000;

let outbox: OutboxEntry[] = [];
let outboxLoaded = false;
const listeners = new Set<() => void>();

function loadOutbox() {
  if (outboxLoaded || typeof window === "undefined") return;
  outboxLoaded = true;
  try {
    const stored = JSON.parse(window.localStorage.getItem(OUTBOX_STORAGE_KEY) ?? "[]");
    outbox = Array.isArray(stored) ? stored.filter((entry) => entry?.op && entry?.householdId && entry?.userId) : [];
  } catch {
    outbox = [];
  }
}

function setOutbox(next: OutboxEntry[]) {
  outbox = next;
  try {
    window.localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or unavailable; the changes are still sent while the app is open.
  }
  listeners.forEach((listener) => listener());
}

function subscribeOutbox(listener: () => void) {
  loadOutbox();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getOutbox = () => {
  loadOutbox();
  return outbox;
};

const EMPTY_OUTBOX: OutboxEntry[] = [];

function enqueue(entries: Omit<OutboxEntry, "id">[]) {
  loadOutbox();
  setOutbox([...outbox, ...entries.map((entry) => ({ ...entry, id: crypto.randomUUID() }))]);
}

async function send(entry: OutboxEntry) {
  const supabase = createClient();
  const { op, householdId, weekKey } = entry;

  switch (op.type) {
    case "mark": {
      const row = { household_id: householdId, week_start_date: weekKey!, kind: op.kind, item_key: op.key };
      return op.on
        ? supabase
            .from("shopping_marks")
            .upsert(row, { onConflict: "household_id,week_start_date,kind,item_key", ignoreDuplicates: true })
        : supabase.from("shopping_marks").delete().match(row);
    }
    case "add-custom":
      return supabase.from("shopping_items").upsert(
        { id: op.item.id, household_id: householdId, kind: "custom", label: op.item.label, amount: op.item.amount ?? null },
        { onConflict: "id", ignoreDuplicates: true },
      );
    case "add-extra":
      return supabase.from("shopping_items").upsert(
        {
          id: op.extra.id,
          household_id: householdId,
          week_start_date: weekKey,
          kind: "extra",
          label: op.extra.recipeName.trim().slice(0, 200) || "Rezept",
          lines: op.extra.lines.slice(0, 200),
          multiplier: Math.min(100, Math.max(0, op.extra.multiplier)),
        },
        { onConflict: "id", ignoreDuplicates: true },
      );
    case "remove-item":
      return supabase.from("shopping_items").delete().eq("id", op.id).eq("household_id", householdId);
    case "settings":
      return supabase.rpc("set_shopping_settings", {
        p_household_id: householdId,
        p_hide_basics: op.hideBasics ?? null,
        p_section_order: op.sectionOrder ?? null,
      });
  }
}

// No connection, or a request that never got an answer: worth retrying. Errors
// the database answered with (e.g. a limit) would fail again and are dropped.
const isRetryable = (error: { code?: string; message?: string } | null) =>
  typeof navigator !== "undefined" && !navigator.onLine ? true : !error?.code;

/**
 * Writes a sent change into the cached data, so it doesn't flicker away between
 * leaving the outbox and the refetch that confirms it.
 */
function commitToCache(queryClient: QueryClient, entry: OutboxEntry) {
  const { op, householdId, weekKey, userId } = entry;

  if (op.type === "settings") {
    queryClient.setQueryData<HouseholdsData>(queryKeys.households(userId), (data) =>
      data
        ? {
            ...data,
            households: data.households.map((household) =>
              household.id === householdId
                ? {
                    ...household,
                    shoppingHideBasics: op.hideBasics ?? household.shoppingHideBasics,
                    shoppingSectionOrder: op.sectionOrder ?? household.shoppingSectionOrder,
                  }
                : household,
            ),
          }
        : data,
    );
    return;
  }

  // Own items show in every week; marks and extras only in their own.
  for (const [key, data] of queryClient.getQueriesData<ServerShopping | null>({ queryKey: ["shopping", householdId] })) {
    if (!data || (weekKey !== null && key[2] !== weekKey)) continue;
    const next = applyShoppingOps({ ...data.state, hideBasics: true, sectionOrder: [] }, [op]);
    queryClient.setQueryData<ServerShopping>(key, {
      ids: data.ids,
      state: {
        checked: next.checked,
        removed: next.removed,
        excludedRecipeIds: next.excludedRecipeIds,
        customItems: next.customItems,
        extras: next.extras,
      },
    });
  }
}

let flushing: Promise<void> | null = null;

function flushOutbox(queryClient: QueryClient, userId: string) {
  if (flushing) return flushing;

  flushing = (async () => {
    let sent = false;
    for (;;) {
      const entry = getOutbox().find((candidate) => candidate.userId === userId);
      if (!entry) break;

      let error: { code?: string; message?: string } | null;
      try {
        ({ error } = await send(entry));
      } catch (thrown) {
        // A request that failed without an answer, e.g. the connection dropped.
        console.error(thrown);
        error = { message: String(thrown) };
      }
      if (error && isRetryable(error)) break;
      if (error) {
        console.error("Shopping change dropped", error);
        toast.error("Eine Änderung an der Einkaufsliste ging nicht durch");
      } else {
        commitToCache(queryClient, entry);
      }
      setOutbox(getOutbox().filter((candidate) => candidate.id !== entry.id));
      sent = true;
    }

    if (sent) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["shopping"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.households(userId) }),
      ]);
    }
  })().finally(() => {
    flushing = null;
  });

  return flushing;
}

const IMPORT_FLAG_PREFIX = "weekly-meal-planner:shopping-imported:";

/**
 * Moves the list this browser kept before migration 031 into the user's
 * personal household, once per browser. Lists from several devices add up.
 */
function importLegacyList(userId: string, personalHouseholdId: string) {
  const flag = IMPORT_FLAG_PREFIX + userId;
  try {
    if (window.localStorage.getItem(flag)) return false;
    const currentWeek = getWeekKey(getWeekMonday(0));
    const { weeks, general } = collectLegacyImport(window.localStorage, currentWeek, getWeekKey(getWeekMonday(-4)));
    const entries: Omit<OutboxEntry, "id">[] = [
      ...general.map((op) => ({ userId, householdId: personalHouseholdId, weekKey: null, op })),
      ...Object.entries(weeks).flatMap(([weekKey, ops]) =>
        ops.map((op) => ({ userId, householdId: personalHouseholdId, weekKey, op })),
      ),
    ];
    window.localStorage.setItem(flag, new Date().toISOString());
    if (entries.length > 0) enqueue(entries);
    return entries.length > 0;
  } catch {
    // Storage unavailable: nothing to import.
    return false;
  }
}

const NO_OP = () => {};

/**
 * The household's list, or "local" when the database can't hold it yet
 * (migration 030 or 031 missing).
 */
function useSharedShoppingStore(): ShoppingStore | "local" {
  const queryClient = useQueryClient();
  const { userId, householdId, weekStart } = useWeekScope();
  const { household, data: households } = useActiveHousehold();
  const ready = Boolean(userId && householdId && households?.ready);

  const { data } = useQuery({
    queryKey: queryKeys.shopping(householdId ?? "", weekStart),
    queryFn: () => fetchShopping(householdId!, weekStart),
    enabled: ready,
  });

  const entries = useSyncExternalStore(subscribeOutbox, getOutbox, () => EMPTY_OUTBOX);
  const mine = useMemo(
    () => entries.filter((entry) => entry.userId === userId && entry.householdId === householdId),
    [entries, userId, householdId],
  );

  const apply = useCallback(
    (op: ShoppingOp) => {
      if (!userId || !householdId) return;
      // Marks and extras belong to the week; own items and settings don't.
      const weekKey = op.type === "mark" || op.type === "add-extra" ? weekStart : null;
      enqueue([{ userId, householdId, weekKey, op }]);
      void flushOutbox(queryClient, userId);
    },
    [queryClient, userId, householdId, weekStart],
  );

  // Loaded at least once, so migration 031 is known to be there.
  const sharedReady = ready && data !== null && data !== undefined;

  // The one-time move of this browser's list, then sending anything left over
  // from last time (e.g. checks made offline before the app was closed).
  useEffect(() => {
    if (!sharedReady || !userId || !households) return;
    const personal = households.households.find((entry) => entry.isPersonal);
    if (personal) importLegacyList(userId, personal.id);
    void flushOutbox(queryClient, userId);
  }, [sharedReady, userId, households, queryClient]);

  // Retry while changes wait: when the connection is back, the app is shown
  // again, or every few seconds.
  const waiting = mine.length > 0;
  useEffect(() => {
    if (!waiting || !userId) return;
    const retry = () => void flushOutbox(queryClient, userId);
    const onVisible = () => document.visibilityState === "visible" && retry();
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(retry, RETRY_MS);
    return () => {
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [waiting, userId, queryClient]);

  const state = useMemo(() => {
    // Nothing loaded or cached yet: an empty list, which fills in shortly.
    const loaded = data?.state ?? EMPTY_SHOPPING_STATE;
    const server: ShoppingState = {
      ...loaded,
      hideBasics: household?.shoppingHideBasics ?? true,
      sectionOrder: household?.shoppingSectionOrder ?? [],
    };
    const ops = mine
      .filter((entry) => entry.weekKey === null || entry.weekKey === weekStart)
      .map((entry) => entry.op);
    return applyShoppingOps(server, ops);
  }, [data, household, mine, weekStart]);

  // Households still loading: show an empty list rather than this browser's old one.
  if (!households) return { state: EMPTY_SHOPPING_STATE, apply: NO_OP, shared: true, pending: 0 };
  if (!households.ready || data === null) return "local";
  return { state, apply, shared: true, pending: mine.length };
}

/**
 * Brings the other members' list changes (and pantry staples and list
 * settings) into the open app as they happen.
 */
export function useShoppingRealtime() {
  const queryClient = useQueryClient();
  const { userId, householdId, weekStart } = useWeekScope();
  const { data: households } = useActiveHousehold();
  const ready = Boolean(households?.ready && householdId && userId);

  useEffect(() => {
    if (!ready || !householdId || !userId) return;

    const supabase = createClient();
    const shoppingKey = queryKeys.shopping(householdId, weekStart);
    const pantryKey = queryKeys.pantryStaples(userId, householdId);
    const timers = new Map<string, number>();
    // Bursts of changes (e.g. the import) refetch once.
    const refresh = (key: readonly unknown[]) => {
      const id = JSON.stringify(key);
      window.clearTimeout(timers.get(id));
      timers.set(id, window.setTimeout(() => void queryClient.invalidateQueries({ queryKey: key }), 300));
    };
    const knownShoppingId = (id: string | undefined) =>
      Boolean(id && queryClient.getQueryData<ServerShopping | null>(shoppingKey)?.ids.includes(id));
    const knownPantryId = (id: string | undefined) =>
      Boolean(id && queryClient.getQueryData<PantryData>(pantryKey)?.ids.includes(id));
    const filter = `household_id=eq.${householdId}`;

    const channel = supabase
      .channel(`shopping:${householdId}:${weekStart}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "shopping_marks", filter }, () => refresh(shoppingKey))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "shopping_items", filter }, () => refresh(shoppingKey))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pantry_staples", filter }, () => refresh(pantryKey))
      // Deletes can't be filtered and only carry the id; check it against what is shown.
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "shopping_marks" }, (payload) => {
        if (knownShoppingId((payload.old as { id?: string }).id)) refresh(shoppingKey);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "shopping_items" }, (payload) => {
        if (knownShoppingId((payload.old as { id?: string }).id)) refresh(shoppingKey);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "pantry_staples" }, (payload) => {
        if (knownPantryId((payload.old as { id?: string }).id)) refresh(pantryKey);
      })
      // Hide basics and aisle order live on the household.
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "households", filter: `id=eq.${householdId}` }, () =>
        refresh(queryKeys.households(userId)),
      )
      .subscribe();

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      void supabase.removeChannel(channel);
    };
  }, [queryClient, ready, householdId, userId, weekStart]);
}

// This browser only ------------------------------------------------------------

// Recipe screens change the list while it may be mounted in the desktop panel.
const LOCAL_CHANGE_EVENT = "weekly-meal-planner:shopping-change";

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable; the change lasts until the page is reloaded.
  }
}

function writeLocalState(weekKey: string, state: ShoppingState) {
  writeJson(legacyKeys.checked(weekKey), state.checked);
  writeJson(legacyKeys.removed(weekKey), state.removed);
  writeJson(legacyKeys.week(weekKey), { excludedRecipeIds: state.excludedRecipeIds, extras: state.extras });
  writeJson(legacyKeys.custom, state.customItems);
  writeJson(legacyKeys.hideBasics, state.hideBasics);
  writeJson(legacyKeys.sectionOrder, state.sectionOrder);
}

/**
 * The list kept in this browser, as before migration 031; with `persist` off
 * (landing page demo) only in memory.
 */
export function useLocalShoppingStore(persist: boolean): ShoppingStore {
  const { weekKey, isCurrentWeek } = useSelectedWeek();
  const [state, setState] = useState<ShoppingState>(EMPTY_SHOPPING_STATE);

  useEffect(() => {
    if (!persist) return;
    const load = () => {
      try {
        setState(readLegacyWeek(window.localStorage, weekKey, isCurrentWeek));
      } catch {
        setState(EMPTY_SHOPPING_STATE);
      }
    };
    load();
    window.addEventListener(LOCAL_CHANGE_EVENT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(LOCAL_CHANGE_EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, [persist, weekKey, isCurrentWeek]);

  const update = useCallback(
    (change: (current: ShoppingState) => ShoppingState) => {
      if (!persist) {
        setState(change);
        return;
      }
      let current = EMPTY_SHOPPING_STATE;
      try {
        current = readLegacyWeek(window.localStorage, weekKey, isCurrentWeek);
      } catch {
        // Unreadable storage counts as an empty list.
      }
      const next = change(current);
      writeLocalState(weekKey, next);
      setState(next);
      window.dispatchEvent(new Event(LOCAL_CHANGE_EVENT));
    },
    [persist, weekKey, isCurrentWeek],
  );

  const apply = useCallback((op: ShoppingOp) => update((current) => applyShoppingOps(current, [op])), [update]);

  const forgetChecks = useCallback(
    (validKeys: Set<string>) =>
      update((current) => {
        const checked = current.checked.filter((key) => validKeys.has(key));
        return checked.length === current.checked.length ? current : { ...current, checked };
      }),
    [update],
  );

  return useMemo(() => ({ state, apply, shared: false, pending: 0, forgetChecks }), [state, apply, forgetChecks]);
}

/**
 * The shopping list of the selected week in the active household; in this
 * browser alone until migration 031 has run.
 */
export function useShoppingStore(): ShoppingStore {
  const shared = useSharedShoppingStore();
  const local = useLocalShoppingStore(shared === "local");
  return shared === "local" ? local : shared;
}

// Helpers for callers --------------------------------------------------------

export const markOp = (kind: ShoppingMarkKind, key: string, on: boolean): ShoppingOp | null =>
  key.length > 0 && key.length <= ITEM_KEY_MAX ? { type: "mark", kind, key, on } : null;

export function customItemOp(label: string, amount?: string): ShoppingOp | null {
  const item = cleanCustomItem({ id: crypto.randomUUID(), label, amount });
  return item ? { type: "add-custom", item } : null;
}

export const extraOp = (extra: Omit<ShoppingExtra, "id">): ShoppingOp => ({
  type: "add-extra",
  extra: { ...extra, id: crypto.randomUUID() },
});

// Pantry staples ---------------------------------------------------------------

// byHousehold: loaded by household (migration 031) rather than by user.
export type PantryData = { names: string[]; ids: string[]; byHousehold: boolean };
