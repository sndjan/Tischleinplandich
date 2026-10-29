"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useEntrance } from "@/hooks/use-entrance";

type CloseGuardSetter = (guard: (() => void) | null) => void;

const CloseGuardContext = createContext<CloseGuardSetter | null>(null);

/**
 * Lets a screen inside the panel run its own back action (e.g. "Änderungen
 * verwerfen?") when the dimmed area or Escape closes the panel. Does nothing
 * outside the panel.
 */
export function usePanelCloseGuard(guard: () => void) {
  const setGuard = useContext(CloseGuardContext);
  const guardRef = useRef(guard);
  guardRef.current = guard;

  useEffect(() => {
    if (!setGuard) return;
    setGuard(() => guardRef.current());
    return () => setGuard(null);
  }, [setGuard]);
}

/**
 * Desktop panel that slides in from the right over a dimmed planner. Screens
 * inside keep their own sticky header and footer; the panel is their scroll
 * container. Clicking the dimmed area or pressing Escape closes it.
 */
export function SidePanel({
  open,
  label,
  onClose,
  children,
}: {
  // False while a full-page screen (e.g. cooking) sits on top; the panel stays
  // mounted underneath so its screens keep their state.
  open: boolean;
  label: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { entering, onAnimationEnd } = useEntrance();
  const guardRef = useRef<(() => void) | null>(null);
  const setGuardRef = useRef<CloseGuardSetter>((guard) => {
    guardRef.current = guard;
  });
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const requestClose = () => (guardRef.current ?? onCloseRef.current)();

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      // A sheet or dialog inside the panel handles Escape itself.
      if (event.key !== "Escape" || document.querySelector('[aria-modal="true"]')) return;
      (guardRef.current ?? onCloseRef.current)();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <div data-overlay={open || undefined} className={cn("fixed inset-0 z-50", !open && "hidden")}>
      <button
        type="button"
        aria-label="Panel schließen"
        onClick={requestClose}
        className={cn("absolute inset-0 bg-brand-ink/25", entering && "animate-[fade-up_200ms_ease-out_both]")}
      />
      <section
        role="dialog"
        aria-label={label}
        onAnimationEnd={onAnimationEnd}
        className={cn(
          "absolute inset-y-0 right-0 w-[min(500px,100vw)] overflow-y-auto overscroll-contain rounded-l-3xl bg-white shadow-2xl",
          entering && "animate-panel-in",
        )}
      >
        <CloseGuardContext.Provider value={setGuardRef.current}>{children}</CloseGuardContext.Provider>
      </section>
    </div>
  );
}
