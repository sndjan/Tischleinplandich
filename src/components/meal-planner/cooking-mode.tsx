"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Check, Lightbulb, Timer, X } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import type { Recipe } from "@/types/database";
import { findStepTimer, formatTimer, ingredientsForStep, scaleIngredients } from "@/lib/recipe-scaling";

/**
 * Keeps the screen on while mounted. The browser drops the wake lock whenever the
 * page is hidden, so it is re-requested each time the page becomes visible again.
 * Returns whether the screen is being kept on.
 */
function useScreenWakeLock() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!("wakeLock" in navigator)) {
      return;
    }

    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;

    const requestWakeLock = async () => {
      if (document.visibilityState !== "visible" || (sentinel && !sentinel.released)) {
        return;
      }

      try {
        const nextSentinel = await navigator.wakeLock.request("screen");

        if (disposed) {
          void nextSentinel.release();
          return;
        }

        sentinel = nextSentinel;
        setActive(true);
        nextSentinel.addEventListener("release", () => !disposed && setActive(false));
      } catch {
        // Denied (e.g. battery saver) – cooking mode still works, the screen just may turn off.
      }
    };

    void requestWakeLock();
    document.addEventListener("visibilitychange", requestWakeLock);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", requestWakeLock);
      void sentinel?.release();
    };
  }, []);

  return active;
}

type RunningTimer = { id: string; label: string; endsAt: number; done: boolean };

// A short double beep, so a finished timer is heard across the kitchen.
function beep() {
  try {
    const AudioContextClass =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const context = new AudioContextClass();
    [0, 0.35].forEach((offset) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.25, context.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + offset + 0.3);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + offset);
      oscillator.stop(context.currentTime + offset + 0.3);
    });
    window.setTimeout(() => void context.close(), 1000);
  } catch {
    // No audio available; the vibration and toast still signal the timer.
  }
}

/**
 * Timers that keep running while the cook moves between steps. Time is measured
 * against the clock, so a timer stays right when the phone was locked.
 */
function useTimers() {
  const [timers, setTimers] = useState<RunningTimer[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!timers.some((timer) => !timer.done)) return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [timers]);

  useEffect(() => {
    const finished = timers.filter((timer) => !timer.done && timer.endsAt <= now);
    if (finished.length === 0) return;

    setTimers((prev) => prev.map((timer) => (finished.some((f) => f.id === timer.id) ? { ...timer, done: true } : timer)));
    beep();
    if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
    finished.forEach((timer) => toast.success(`${timer.label}: Zeit ist um`, { duration: 8000 }));
  }, [now, timers]);

  const start = (label: string, seconds: number) => {
    setNow(Date.now());
    setTimers((prev) => [...prev, { id: crypto.randomUUID(), label, endsAt: Date.now() + seconds * 1000, done: false }]);
  };

  const stop = (id: string) => setTimers((prev) => prev.filter((timer) => timer.id !== id));

  return { timers, now, start, stop };
}

const getSteps = (text: string | null) =>
  (text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^\d+[.)]\s*/, ""))
    .filter(Boolean);

interface CookingModeProps {
  recipe: Recipe;
  // Portions being cooked; ingredient amounts are scaled to it.
  servings?: number;
  onBack: () => void;
}

export function CookingMode({ recipe, servings, onBack }: CookingModeProps) {
  const keptOn = useScreenWakeLock();
  const { timers, now, start, stop } = useTimers();

  const baseServings = recipe.serving_size > 0 ? recipe.serving_size : 1;
  const factor = (servings ?? baseServings) / baseServings;
  const ingredients = useMemo(() => scaleIngredients(recipe.ingredients, factor), [recipe.ingredients, factor]);
  const steps = useMemo(() => getSteps(recipe.preparation_steps), [recipe.preparation_steps]);

  // Step 0 is the ingredient checklist, followed by one step per preparation line.
  const totalSteps = steps.length + 1;
  const [stepIndex, setStepIndex] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const isChecklist = stepIndex === 0;
  const isLastStep = stepIndex === totalSteps - 1;
  const step = isChecklist ? "" : steps[stepIndex - 1] ?? "";
  const stepTimer = isChecklist ? null : findStepTimer(step);
  const stepIngredients = isChecklist ? [] : ingredientsForStep(step, ingredients);
  const timerLabel = `Schritt ${stepIndex}`;
  const stepTimerRunning = timers.some((timer) => timer.label === timerLabel && !timer.done);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [stepIndex]);

  const toggleIngredient = (id: string) => {
    if (navigator.vibrate) navigator.vibrate(8);
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const goTo = (index: number) => setStepIndex(Math.min(Math.max(index, 0), totalSteps - 1));

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="sticky top-0 z-30 space-y-3 bg-white px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Kochmodus beenden"
            className="flex size-11 items-center justify-center rounded-full bg-brand-chip-neutral text-brand-ink transition-transform active:scale-90"
          >
            <X className="size-[18px]" strokeWidth={2.5} />
          </button>
          <span className="text-sm font-bold text-brand-ink">
            {isChecklist ? "Zutaten bereitlegen" : `Schritt ${stepIndex} von ${totalSteps - 1}`}
          </span>
          {keptOn ? (
            <span className="flex h-[30px] items-center gap-1 rounded-full bg-[#fff7e6] px-2.5 text-xs font-bold text-[#8a5a00]">
              <Lightbulb className="size-3.5" />
              Bleibt an
            </span>
          ) : (
            <span className="w-11" />
          )}
        </div>
        <div className="flex gap-1" aria-hidden="true">
          {Array.from({ length: totalSteps }, (_, index) => (
            <button
              key={index}
              type="button"
              tabIndex={-1}
              onClick={() => goTo(index)}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                index <= stepIndex ? "bg-brand-accent" : "bg-brand-track",
              )}
            />
          ))}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 pb-6 pt-4">
        <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-brand-accent-dark">{recipe.name}</p>

        {isChecklist ? (
          ingredients.length > 0 ? (
            <ul className="space-y-2">
              {ingredients.map((ingredient) => {
                const isChecked = checked.has(ingredient.id);
                return (
                  <li key={ingredient.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isChecked}
                      onClick={() => toggleIngredient(ingredient.id)}
                      className={cn(
                        "flex min-h-14 w-full touch-manipulation items-center gap-3 rounded-2xl px-3.5 text-left ring-1 transition-all active:scale-[0.98]",
                        isChecked ? "bg-brand-app-bg ring-transparent" : "bg-white ring-brand-card-border",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
                          isChecked ? "bg-brand-accent text-white" : "border-2 border-brand-disabled",
                        )}
                      >
                        {isChecked && <Check className="size-4 animate-pop-in" strokeWidth={3} />}
                      </span>
                      <span className={cn("text-[17px]", isChecked ? "text-brand-muted line-through" : "text-brand-ink")}>
                        {ingredient.amount && <b className="mr-1.5">{ingredient.amount}</b>}
                        {ingredient.name}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-brand-tertiary">Keine Zutaten</p>
          )
        ) : (
          <>
            <p className="text-[26px] font-semibold leading-[1.35] text-brand-ink">
              {stepTimer ? (
                <>
                  {step.slice(0, stepTimer.index)}
                  <mark className="rounded-md bg-brand-accent-bg px-1 text-brand-accent-dark">{stepTimer.label}</mark>
                  {step.slice(stepTimer.index + stepTimer.length)}
                </>
              ) : (
                step
              )}
            </p>

            {stepIngredients.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-xs font-bold uppercase tracking-[0.06em] text-brand-secondary">Für diesen Schritt</h2>
                <div className="flex flex-wrap gap-2">
                  {stepIngredients.map((ingredient) => (
                    <span key={ingredient.id} className="flex min-h-9 items-center gap-1.5 rounded-xl bg-brand-chip-neutral px-3 py-1.5 text-[15px] text-brand-ink">
                      {ingredient.amount && <b>{ingredient.amount}</b>}
                      {ingredient.name}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {stepTimer && (
              <button
                type="button"
                disabled={stepTimerRunning}
                onClick={() => start(timerLabel, stepTimer.seconds)}
                className="flex h-16 items-center justify-center gap-2.5 rounded-[18px] border-2 border-brand-accent bg-brand-accent-bg-light text-lg font-bold text-brand-accent-dark transition-transform active:scale-[0.97] disabled:opacity-50"
              >
                <Timer className="size-[22px]" />
                {stepTimerRunning ? "Timer läuft" : `Timer ${formatTimer(stepTimer.seconds)} starten`}
              </button>
            )}
          </>
        )}

        {isChecklist && steps.length === 0 && (
          <p className="text-sm text-brand-tertiary">Für dieses Rezept sind keine Zubereitungsschritte hinterlegt.</p>
        )}

        {timers.length > 0 && (
          <div className="mt-auto flex flex-col items-center gap-2" aria-live="polite">
            {timers.map((timer) => {
              const left = Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
              return (
                <div
                  key={timer.id}
                  className={cn(
                    "flex h-11 animate-fade-up items-center gap-2.5 rounded-full pl-3.5 pr-1.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(0,0,0,0.18)]",
                    timer.done ? "animate-pulse bg-brand-red" : "bg-brand-ink",
                  )}
                >
                  <span className={cn("size-2 rounded-full", timer.done ? "bg-white" : "bg-brand-orange")} />
                  {timer.label}
                  <b className="tabular-nums">{timer.done ? "Fertig!" : formatTimer(left)}</b>
                  <button
                    type="button"
                    onClick={() => stop(timer.id)}
                    aria-label={`${timer.label} Timer beenden`}
                    className="flex size-[30px] items-center justify-center rounded-full bg-white/15 transition-transform active:scale-90"
                  >
                    <X className="size-3.5" strokeWidth={3} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer className="sticky bottom-0 z-30 border-t border-brand-card-border bg-white">
        <div className="mx-auto flex w-full max-w-2xl gap-2.5 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => goTo(stepIndex - 1)}
            disabled={isChecklist}
            className="h-14 w-[120px] rounded-2xl bg-brand-chip-neutral text-base font-bold text-brand-ink transition-transform active:scale-[0.97] disabled:opacity-40"
          >
            Zurück
          </button>
          <button
            type="button"
            onClick={() => (isLastStep ? onBack() : goTo(stepIndex + 1))}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-accent-dark text-[17px] font-bold text-white transition-transform active:scale-[0.97]"
          >
            {isLastStep ? (
              <Fragment>
                <Check className="size-5" strokeWidth={3} />
                Fertig
              </Fragment>
            ) : isChecklist ? (
              "Los geht's"
            ) : (
              "Weiter"
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
