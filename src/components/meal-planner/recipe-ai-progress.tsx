"use client";

import { Check, Clock, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { RecipeDraft, RecipeStreamStage } from "@/lib/recipe-draft";
import { formatIngredientAmount, parseIngredientLine } from "@/lib/editable-recipe";

export type ProgressStep = { label: string; status: "active" | "done" | "waiting" };

const STAGE_ORDER: RecipeStreamStage[] = ["reading", "ingredients", "steps", "nutrition"];

const STAGE_PROGRESS: Record<RecipeStreamStage, number> = {
  reading: 18,
  ingredients: 45,
  steps: 70,
  nutrition: 90,
};

interface RecipeAiProgressProps {
  title: string;
  // Steps reported before the AI writes, e.g. reading a link.
  extraSteps: ProgressStep[];
  stage: RecipeStreamStage;
  draft: RecipeDraft | null;
  isIdea: boolean;
  onCancel: () => void;
}

/**
 * Shown while the AI reads or writes a recipe: a checklist of what happened so far
 * and the recipe filling in as it arrives.
 */
export function RecipeAiProgress({
  title,
  extraSteps,
  stage,
  draft,
  isIdea,
  onCancel,
}: RecipeAiProgressProps) {
  const stageIndex = STAGE_ORDER.indexOf(stage);
  const statusFor = (target: RecipeStreamStage): ProgressStep["status"] => {
    const targetIndex = STAGE_ORDER.indexOf(target);
    if (targetIndex < stageIndex) return "done";
    return targetIndex === stageIndex ? "active" : "waiting";
  };

  const steps: ProgressStep[] = [
    ...extraSteps,
    {
      label: isIdea ? "Rezept wird geschrieben" : "Rezept wird erkannt",
      status: stage === "reading" ? "active" : "done",
    },
    { label: "Zutaten", status: statusFor("ingredients") },
    { label: "Zubereitung", status: statusFor("steps") },
    { label: "Nährwerte schätzen", status: statusFor("nutrition") },
  ];

  const ingredientLines = (draft?.ingredients ?? "").split("\n").filter(Boolean);
  const stepLines = (draft?.preparation_steps ?? "").split("\n").filter(Boolean);

  return (
    <div className="flex min-h-dvh flex-col bg-brand-app-bg">
      <header className="sticky top-0 z-40 border-b border-brand-card-border bg-white">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-2 py-3 pl-4 pr-2">
          <h1 className="font-heading text-lg font-bold text-brand-ink" aria-live="polite">
            {title}
          </h1>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Abbrechen"
            className="flex size-11 items-center justify-center rounded-xl text-brand-ink active:bg-brand-chip-neutral"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="h-[3px] bg-brand-track">
          <div
            className="h-full bg-brand-accent-dark transition-[width] duration-500 ease-out"
            style={{ width: `${STAGE_PROGRESS[stage]}%` }}
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-3.5 p-4">
        <ol
          aria-label="Fortschritt"
          className="space-y-2.5 rounded-2xl border border-brand-card-border bg-white px-3.5 py-3"
        >
          {steps.map((step, index) => (
            <li
              key={`${index}-${step.label}`}
              className={cn(
                "flex items-center gap-2.5 text-sm",
                step.status === "active" && "font-semibold",
                step.status === "waiting" && "text-brand-secondary",
              )}
            >
              {step.status === "done" ? (
                <span className="animate-pop-in flex size-[22px] shrink-0 items-center justify-center rounded-full bg-brand-accent-dark text-white">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
              ) : step.status === "active" ? (
                <span className="size-[22px] shrink-0 animate-spin rounded-full border-[2.5px] border-brand-track border-t-brand-accent-dark" />
              ) : (
                <span className="size-[22px] shrink-0 rounded-full border-2 border-brand-icon-muted" />
              )}
              {step.label}
              {step.status === "active" && " …"}
            </li>
          ))}
        </ol>

        <article className="overflow-hidden rounded-2xl border border-brand-card-border bg-white">
          <div className="space-y-3 p-3.5">
            {draft?.name ? (
              <h2 className="font-heading animate-fade-up text-xl font-extrabold leading-tight">
                {draft.name}
              </h2>
            ) : (
              <Skeleton className="h-6 w-3/4" />
            )}

            <div className="flex gap-2">
              {draft?.prep_time ? (
                <span className="animate-fade-up inline-flex h-7 items-center gap-1 rounded-full bg-brand-chip-neutral px-2.5 text-xs font-semibold">
                  <Clock className="size-3.5" />
                  {draft.prep_time}
                </span>
              ) : (
                <Skeleton className="h-7 w-20 rounded-full" />
              )}
              {stageIndex >= 1 && draft ? (
                <span className="animate-fade-up inline-flex h-7 items-center rounded-full bg-brand-chip-neutral px-2.5 text-xs font-semibold">
                  {draft.serving_size} {draft.serving_size === 1 ? "Portion" : "Portionen"}
                </span>
              ) : (
                <Skeleton className="h-7 w-24 rounded-full" />
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-secondary">
                Zutaten
              </p>
              {ingredientLines.map((line, index) => {
                const row = parseIngredientLine(line);
                return (
                  <div key={index} className="animate-fade-up flex gap-2.5 text-sm">
                    <span className="w-16 shrink-0 font-bold">{formatIngredientAmount(row)}</span>
                    <span>{row.name}</span>
                  </div>
                );
              })}
              {stage === "reading" || stage === "ingredients" ? (
                <>
                  <SkeletonRow width="w-36" />
                  {ingredientLines.length < 3 && <SkeletonRow width="w-28" />}
                </>
              ) : null}
            </div>

            <div className="space-y-2">
              <p
                className={cn(
                  "text-xs font-bold uppercase tracking-wide",
                  stageIndex >= 2 ? "text-brand-secondary" : "text-brand-muted",
                )}
              >
                Zubereitung
              </p>
              {stepLines.map((line, index) => (
                <p key={index} className="animate-fade-up flex gap-2.5 text-sm leading-relaxed">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-accent-bg text-[11px] font-bold text-brand-accent-dark">
                    {index + 1}
                  </span>
                  {line}
                </p>
              ))}
              {stage !== "nutrition" && (
                <>
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                </>
              )}
            </div>
          </div>
        </article>
      </main>

      <div className="sticky bottom-0 z-30 border-t border-brand-card-border bg-white">
        <div className="mx-auto w-full max-w-2xl space-y-2 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-brand-track-alt text-base font-bold text-brand-accent-dark">
            <span className="size-[18px] animate-spin rounded-full border-[2.5px] border-[#a9cdb4] border-t-brand-accent-dark" />
            Gleich fertig …
          </div>
          <p className="text-center text-xs text-brand-secondary">
            Du kannst schon mitlesen. Bearbeiten geht, sobald alles da ist.
          </p>
        </div>
      </div>
    </div>
  );
}

function SkeletonRow({ width }: { width: string }) {
  return (
    <div className="flex gap-2.5">
      <Skeleton className="h-3 w-16" />
      <Skeleton className={cn("h-3", width)} />
    </div>
  );
}
