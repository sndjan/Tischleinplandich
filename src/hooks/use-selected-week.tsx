"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { getWeekKey, getWeekLabel, getWeekMonday } from "@/lib/week";

type SelectedWeekState = {
  // Weeks from the current one: 0 this week, 1 next week, -1 last week.
  offset: number;
  setOffset: (offset: number) => void;
};

// Without a provider (e.g. the landing page demo) it is always this week.
const SelectedWeekContext = createContext<SelectedWeekState>({ offset: 0, setOffset: () => {} });

export function SelectedWeekProvider({ children }: { children: React.ReactNode }) {
  const [offset, setOffset] = useState(0);
  const value = useMemo(() => ({ offset, setOffset }), [offset]);
  return <SelectedWeekContext.Provider value={value}>{children}</SelectedWeekContext.Provider>;
}

/**
 * The week the planner shows. The plan, the shopping list and every screen that
 * adds meals follow it.
 */
export function useSelectedWeek() {
  const { offset, setOffset } = useContext(SelectedWeekContext);

  return useMemo(() => {
    const monday = getWeekMonday(offset);
    return {
      offset,
      setOffset,
      monday,
      weekKey: getWeekKey(monday),
      label: getWeekLabel(offset, monday),
      isCurrentWeek: offset === 0,
    };
  }, [offset, setOffset]);
}
