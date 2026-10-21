"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MealType, Recipe } from "@/types/database";
import type { RecipeDraft } from "@/lib/recipe-draft";

export type Screen =
  | { kind: "recipe-form"; recipe?: Recipe; draft?: RecipeDraft }
  | { kind: "recipe-ai-import" }
  | { kind: "recipe-preview"; recipe: Recipe; tags: string[] }
  | { kind: "add-meal"; dayIndex: number; mealType: MealType }
  | { kind: "nutrition-targets" };

export type ScreenEntry = {
  key: number;
  screen: Screen;
  // Scroll position of the view underneath, restored when this screen closes.
  scrollY: number;
};

interface ScreenStackValue {
  stack: ScreenEntry[];
  openScreen: (screen: Screen) => void;
  replaceScreen: (screen: Screen) => void;
  closeScreen: () => void;
}

const SCREEN_DEPTH_STATE_KEY = "mealPlannerScreenDepth";

const ScreenStackContext = createContext<ScreenStackValue | null>(null);

/**
 * Full-page screens stacked on top of the planner instead of modal dialogs.
 * Every opened screen gets its own browser history entry, so the browser/OS back
 * button (and the iOS swipe-back gesture) closes the topmost screen.
 */
export function ScreenStackProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<ScreenEntry[]>([]);
  const stackRef = useRef(stack);
  const nextKeyRef = useRef(0);
  const pendingScrollYRef = useRef<number | null>(null);

  const commitStack = useCallback((nextStack: ScreenEntry[], scrollY: number) => {
    stackRef.current = nextStack;
    pendingScrollYRef.current = scrollY;
    setStack(nextStack);
  }, []);

  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    const handlePopState = (event: PopStateEvent) => {
      const depth = event.state?.[SCREEN_DEPTH_STATE_KEY];
      const targetDepth = typeof depth === "number" ? depth : 0;
      const currentStack = stackRef.current;

      if (targetDepth >= currentStack.length) {
        return;
      }

      commitStack(currentStack.slice(0, targetDepth), currentStack[targetDepth].scrollY);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, [commitStack]);

  useLayoutEffect(() => {
    if (pendingScrollYRef.current === null) {
      return;
    }

    window.scrollTo(0, pendingScrollYRef.current);
    pendingScrollYRef.current = null;
  }, [stack]);

  const openScreen = useCallback(
    (screen: Screen) => {
      const nextStack = [
        ...stackRef.current,
        { key: nextKeyRef.current++, screen, scrollY: window.scrollY },
      ];

      window.history.pushState({ [SCREEN_DEPTH_STATE_KEY]: nextStack.length }, "");
      commitStack(nextStack, 0);
    },
    [commitStack],
  );

  const replaceScreen = useCallback(
    (screen: Screen) => {
      const currentStack = stackRef.current;
      const topEntry = currentStack[currentStack.length - 1];

      if (!topEntry) {
        openScreen(screen);
        return;
      }

      commitStack(
        [...currentStack.slice(0, -1), { ...topEntry, key: nextKeyRef.current++, screen }],
        0,
      );
    },
    [commitStack, openScreen],
  );

  const closeScreen = useCallback(() => {
    if (stackRef.current.length > 0) {
      window.history.back();
    }
  }, []);

  const value = useMemo(
    () => ({ stack, openScreen, replaceScreen, closeScreen }),
    [stack, openScreen, replaceScreen, closeScreen],
  );

  return <ScreenStackContext.Provider value={value}>{children}</ScreenStackContext.Provider>;
}

export function useScreenStack(): ScreenStackValue {
  const value = useContext(ScreenStackContext);

  if (!value) {
    throw new Error("useScreenStack must be used inside ScreenStackProvider");
  }

  return value;
}
