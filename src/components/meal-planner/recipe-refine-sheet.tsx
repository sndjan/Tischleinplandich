"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, Check, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type RefineExchange = {
  id: string;
  instruction: string;
  summary: string;
  changes: Array<{ before: string | null; after: string }>;
  nutrition: { calories: [string, string]; protein: [string, string] };
  undone: boolean;
};

interface RecipeRefineSheetProps {
  exchanges: RefineExchange[];
  pendingInstruction: string | null;
  onUndo: (exchangeId: string) => void;
  onClose: () => void;
  composer: React.ReactNode;
}

/**
 * Bottom sheet with the AI changes: what was asked, what changed, and undo.
 */
export function RecipeRefineSheet({
  exchanges,
  pendingInstruction,
  onUndo,
  onClose,
  composer,
}: RecipeRefineSheetProps) {
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [exchanges.length, pendingInstruction]);

  const lastActiveId = [...exchanges].reverse().find((exchange) => !exchange.undone)?.id;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Schließen"
        onClick={onClose}
        className="absolute inset-0 bg-brand-ink/40"
      />
      <section
        role="dialog"
        aria-label="Mit KI ändern"
        className="animate-sheet-up relative flex max-h-[85dvh] w-full max-w-2xl flex-col rounded-t-3xl bg-white shadow-2xl"
      >
        <div className="flex justify-center pt-2">
          <span className="h-[5px] w-10 rounded-full bg-brand-icon-muted" />
        </div>
        <div className="flex items-center justify-between px-4 pb-3 pt-2">
          <h2 className="font-heading text-lg font-extrabold">Mit KI ändern</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="flex size-10 items-center justify-center rounded-full bg-brand-chip-neutral active:scale-95"
          >
            <X className="size-4" strokeWidth={2.5} />
          </button>
        </div>

        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
          {exchanges.map((exchange) => (
            <div key={exchange.id} className="space-y-3">
              <p className="ml-auto w-fit max-w-[80%] rounded-[18px] rounded-br-[4px] bg-brand-accent-dark px-3.5 py-2.5 text-[15px] leading-snug text-white">
                {exchange.instruction}
              </p>
              <div
                className={cn(
                  "animate-fade-up max-w-[92%] space-y-2.5 rounded-[18px] rounded-bl-[4px] bg-brand-chip-neutral p-3.5",
                  exchange.undone && "opacity-60",
                )}
              >
                <p className="text-[15px] leading-snug">
                  {exchange.undone ? "Rückgängig gemacht." : exchange.summary}
                </p>
                {!exchange.undone && exchange.changes.length > 0 && (
                  <div className="space-y-2 rounded-xl bg-white p-3 text-sm">
                    {exchange.changes.map((change, index) => (
                      <div key={index} className="flex flex-wrap items-center gap-1.5">
                        {change.before && (
                          <>
                            <span className="text-brand-secondary line-through">{change.before}</span>
                            <ArrowRight className="size-3 text-brand-secondary" strokeWidth={2.5} />
                          </>
                        )}
                        <strong
                          className={cn(
                            !change.before && "rounded-md bg-brand-accent-bg px-1.5 text-brand-accent-dark",
                          )}
                        >
                          {change.after}
                        </strong>
                      </div>
                    ))}
                    <NutritionDelta exchange={exchange} />
                  </div>
                )}
                {exchange.id === lastActiveId && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onUndo(exchange.id)}
                      className="flex h-10 items-center gap-1.5 rounded-full border border-brand-input-border bg-white px-3.5 text-sm font-semibold active:scale-95"
                    >
                      <Undo2 className="size-3.5" strokeWidth={2.5} />
                      Rückgängig
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex h-10 items-center gap-1.5 rounded-full bg-brand-accent-dark px-3.5 text-sm font-bold text-white active:scale-95"
                    >
                      <Check className="size-3.5" strokeWidth={3} />
                      Ansehen
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {pendingInstruction && (
            <div className="space-y-3">
              <p className="ml-auto w-fit max-w-[80%] rounded-[18px] rounded-br-[4px] bg-brand-accent-dark px-3.5 py-2.5 text-[15px] leading-snug text-white">
                {pendingInstruction}
              </p>
              <div className="flex w-fit items-center gap-2 rounded-[18px] rounded-bl-[4px] bg-brand-chip-neutral px-3.5 py-3 text-sm text-brand-secondary">
                <span className="size-4 animate-spin rounded-full border-2 border-brand-track border-t-brand-accent-dark" />
                Ändert das Rezept …
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-brand-card-border px-4 pt-2.5 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {composer}
        </div>
      </section>
    </div>
  );
}

function NutritionDelta({ exchange }: { exchange: RefineExchange }) {
  const [caloriesBefore, caloriesAfter] = exchange.nutrition.calories;
  const [proteinBefore, proteinAfter] = exchange.nutrition.protein;

  if (caloriesBefore === caloriesAfter && proteinBefore === proteinAfter) return null;

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-brand-divider pt-2 text-[13px]">
      {caloriesAfter && caloriesBefore !== caloriesAfter && (
        <span>
          <strong>{caloriesAfter} kcal</strong>
          {caloriesBefore && <span className="text-brand-secondary"> statt {caloriesBefore}</span>}
        </span>
      )}
      {proteinAfter && proteinBefore !== proteinAfter && (
        <span>
          <strong>{proteinAfter} g Protein</strong>
          {proteinBefore && <span className="text-brand-secondary"> statt {proteinBefore}</span>}
        </span>
      )}
    </div>
  );
}
