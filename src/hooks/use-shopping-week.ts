"use client";

import { useCallback, useEffect, useState } from "react";
import type { ShoppingExtra } from "@/lib/shopping-list";
import { useSelectedWeek } from "./use-selected-week";

// Per week, on this device only, like the checked items and custom items.
const STORAGE_PREFIX = "weekly-meal-planner:shopping-list:week:";
// Recipe screens change the list while it may be mounted in the desktop panel.
const CHANGE_EVENT = "weekly-meal-planner:shopping-week-change";

type ShoppingWeekState = {
  excludedRecipeIds: string[];
  extras: ShoppingExtra[];
};

const EMPTY: ShoppingWeekState = { excludedRecipeIds: [], extras: [] };

function readWeek(weekKey: string): ShoppingWeekState {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_PREFIX + weekKey) ?? "null");
    return {
      excludedRecipeIds: Array.isArray(stored?.excludedRecipeIds) ? stored.excludedRecipeIds : [],
      extras: Array.isArray(stored?.extras) ? stored.extras : [],
    };
  } catch {
    return EMPTY;
  }
}

function writeWeek(weekKey: string, state: ShoppingWeekState) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + weekKey, JSON.stringify(state));
  } catch {
    // Storage unavailable; the change is lost on reload.
  }
}

/**
 * What the selected week's shopping list leaves out (recipes bought another time)
 * and adds (ingredients put on the list straight from a recipe).
 */
export function useShoppingWeek() {
  const { weekKey } = useSelectedWeek();
  const [state, setState] = useState<ShoppingWeekState>(EMPTY);

  useEffect(() => {
    const load = () => setState(readWeek(weekKey));
    load();
    window.addEventListener(CHANGE_EVENT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(CHANGE_EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, [weekKey]);

  const update = useCallback(
    (change: (current: ShoppingWeekState) => ShoppingWeekState) => {
      const next = change(readWeek(weekKey));
      writeWeek(weekKey, next);
      setState(next);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [weekKey],
  );

  const toggleRecipe = useCallback(
    (recipeId: string) =>
      update((current) => ({
        ...current,
        excludedRecipeIds: current.excludedRecipeIds.includes(recipeId)
          ? current.excludedRecipeIds.filter((id) => id !== recipeId)
          : [...current.excludedRecipeIds, recipeId],
      })),
    [update],
  );

  const addExtra = useCallback(
    (extra: Omit<ShoppingExtra, "id">) =>
      update((current) => ({ ...current, extras: [...current.extras, { ...extra, id: crypto.randomUUID() }] })),
    [update],
  );

  const removeExtra = useCallback(
    (id: string) => update((current) => ({ ...current, extras: current.extras.filter((extra) => extra.id !== id) })),
    [update],
  );

  return { ...state, toggleRecipe, addExtra, removeExtra };
}
