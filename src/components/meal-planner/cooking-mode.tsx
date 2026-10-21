"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Recipe } from "@/types/database";
import { SubPage } from "./sub-page";
import { getTextLines } from "./recipe-list";

/**
 * Keeps the screen on while mounted. The browser drops the wake lock whenever the
 * page is hidden, so it is re-requested each time the page becomes visible again.
 */
function useScreenWakeLock() {
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
}

interface CookingModeProps {
  recipe: Recipe;
  onBack: () => void;
}

export function CookingMode({ recipe, onBack }: CookingModeProps) {
  useScreenWakeLock();

  const ingredientLines = getTextLines(recipe.ingredients);
  const preparationLines = getTextLines(recipe.preparation_steps);
  // Step 0 is the ingredient checklist, followed by one step per preparation line.
  const totalSteps = preparationLines.length + 1;

  const [stepIndex, setStepIndex] = useState(0);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());

  const isChecklist = stepIndex === 0;
  const isLastStep = stepIndex === totalSteps - 1;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [stepIndex]);

  const toggleIngredient = (index: number) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <SubPage
      title={recipe.name}
      onBack={onBack}
      footer={
        <div className="space-y-3">
          <div className="flex gap-1" aria-hidden>
            {Array.from({ length: totalSteps }, (_, index) => (
              <div
                key={index}
                className={cn(
                  "h-1 flex-1 rounded-full",
                  index <= stepIndex ? "bg-brand-accent-dark" : "bg-brand-chip-neutral",
                )}
              />
            ))}
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 flex-1"
              onClick={() => setStepIndex((prev) => prev - 1)}
              disabled={isChecklist}
            >
              <ChevronLeft className="size-5" />
              Zurück
            </Button>
            <Button
              type="button"
              size="lg"
              className="h-12 flex-1"
              onClick={() => (isLastStep ? onBack() : setStepIndex((prev) => prev + 1))}
            >
              {isLastStep ? (
                <>
                  <Check className="size-5" />
                  Fertig
                </>
              ) : (
                <>
                  {isChecklist ? "Los geht's" : "Weiter"}
                  <ChevronRight className="size-5" />
                </>
              )}
            </Button>
          </div>
        </div>
      }
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
        {isChecklist ? "Zutaten bereitlegen" : `Schritt ${stepIndex} von ${totalSteps - 1}`}
      </p>

      {isChecklist ? (
        ingredientLines.length > 0 ? (
          <ul className="space-y-2">
            {ingredientLines.map((ingredient, index) => {
              const checked = checkedIngredients.has(index);

              return (
                <li key={`${index}-${ingredient}`}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border border-brand-card-border p-3 transition-colors",
                      checked && "bg-brand-app-bg",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleIngredient(index)}
                      className="size-5"
                    />
                    <span
                      className={cn(
                        "text-base text-brand-ink",
                        checked && "text-brand-muted line-through",
                      )}
                    >
                      {ingredient}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-brand-tertiary">Keine Zutaten</p>
        )
      ) : (
        <p className="text-xl leading-relaxed text-brand-ink">
          {preparationLines[stepIndex - 1]}
        </p>
      )}

      {isChecklist && preparationLines.length === 0 && (
        <p className="text-sm text-brand-tertiary">
          Für dieses Rezept sind keine Zubereitungsschritte hinterlegt.
        </p>
      )}
    </SubPage>
  );
}
