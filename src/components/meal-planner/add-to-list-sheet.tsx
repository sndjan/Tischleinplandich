"use client";

import { useMemo, useState } from "react";
import { Check, ShoppingCart } from "lucide-react";
import toast from "react-hot-toast";
import type { Recipe } from "@/types/database";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { scaleIngredients } from "@/lib/recipe-scaling";
import { cn } from "@/lib/utils";
import { useShoppingWeek } from "@/hooks/use-shopping-week";
import { useSelectedWeek } from "@/hooks/use-selected-week";
import { WeekSwitcher } from "./meal-week-view";

/**
 * Puts a recipe's ingredients on the shopping list without planning it: the
 * whole dish, or only the ingredients still missing at home.
 */
export function AddToListSheet({
  recipe,
  servings,
  onClose,
}: {
  recipe: Recipe;
  servings: number;
  onClose: () => void;
}) {
  const { addExtra } = useShoppingWeek();
  const { isCurrentWeek, label: weekLabel } = useSelectedWeek();
  const baseServings = recipe.serving_size > 0 ? recipe.serving_size : 1;
  const factor = servings / baseServings;

  // Raw lines are stored, so the list parses them like a planned recipe's.
  const lines = useMemo(
    () => (recipe.ingredients ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    [recipe.ingredients],
  );
  const scaled = useMemo(() => scaleIngredients(recipe.ingredients, factor), [recipe.ingredients, factor]);
  const [selected, setSelected] = useState<Set<number>>(() => new Set(lines.map((_, index) => index)));

  const toggle = (index: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const allSelected = selected.size === lines.length;

  const add = () => {
    if (navigator.vibrate) navigator.vibrate(10);
    addExtra({
      recipeName: recipe.name,
      lines: lines.filter((_, index) => selected.has(index)),
      multiplier: factor,
    });
    toast.success(`Auf der Einkaufsliste${isCurrentWeek ? "" : ` (${weekLabel})`}`);
    onClose();
  };

  return (
    <BottomSheet title="Auf die Einkaufsliste" onClose={onClose}>
      <div className="space-y-4">
        <WeekSwitcher className="-mx-2 -mt-2" />

        {lines.length === 0 ? (
          <p className="text-sm text-brand-secondary">Dieses Rezept hat noch keine Zutaten.</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] text-brand-secondary">
                Für {servings.toLocaleString("de-DE")} {servings === 1 ? "Portion" : "Portionen"}
              </p>
              <button
                type="button"
                onClick={() => setSelected(allSelected ? new Set() : new Set(lines.map((_, index) => index)))}
                className="h-8 rounded-full px-2.5 text-[13px] font-semibold text-brand-accent-dark active:bg-brand-accent-bg"
              >
                {allSelected ? "Keine" : "Alle"}
              </button>
            </div>
            <ul className="max-h-[45dvh] overflow-y-auto overscroll-contain">
              {scaled.map((ingredient, index) => {
                const checked = selected.has(index);
                return (
                  <li key={ingredient.id} className="border-b border-brand-divider last:border-b-0">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => toggle(index)}
                      className="flex min-h-11 w-full items-center gap-3 py-2 text-left text-[15px]"
                    >
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full transition-all",
                          checked ? "bg-brand-accent text-white" : "border-2 border-brand-disabled",
                        )}
                      >
                        {checked && <Check className="size-3.5" strokeWidth={3} />}
                      </span>
                      <span className="w-[70px] shrink-0 font-bold text-brand-ink">{ingredient.amount}</span>
                      <span className={cn("min-w-0 flex-1", checked ? "text-brand-ink" : "text-brand-muted")}>
                        {ingredient.name}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <button
          type="button"
          onClick={add}
          disabled={selected.size === 0}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-brand-accent-dark text-base font-bold text-white transition-transform active:scale-[0.97] disabled:opacity-40"
        >
          <ShoppingCart className="size-[18px]" />
          {allSelected ? "Ganzes Rezept hinzufügen" : `${selected.size} ${selected.size === 1 ? "Zutat" : "Zutaten"} hinzufügen`}
        </button>
      </div>
    </BottomSheet>
  );
}
