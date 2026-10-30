"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Scale } from "lucide-react";
import {
  balanceTone,
  getBalanceState,
  scoreRecipe,
  scoreWeek,
  type BalanceCategory,
  type BalanceTone,
  type WeekBalanceMeal,
} from "@/lib/balance";
import type { PlannedMeal, Recipe } from "@/types/database";
import { cn } from "@/lib/utils";
import { useNutritionTargets } from "./nutrition-target-settings";

const TONE_RING: Record<BalanceTone, string> = {
  great: "#2f7a52",
  good: "#4f9d6e",
  fair: "#c98a2e",
  low: "#d64545",
};

const TONE_TEXT: Record<BalanceTone, string> = {
  great: "text-brand-accent-dark",
  good: "text-brand-accent-dark",
  fair: "text-brand-warn",
  low: "text-brand-red",
};

/** Whether the "Ausgewogenheit" score is shown at all. */
export function useShowBalance() {
  return useNutritionTargets()[0].show_balance;
}

export function BalanceRing({ score, size = 52 }: { score: number; size?: number }) {
  const tone = balanceTone(score);
  const stroke = size >= 48 ? 5 : 3.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e0efe3" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={TONE_RING[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
        />
      </svg>
      <span
        className={cn(
          "absolute font-heading font-extrabold",
          TONE_TEXT[tone],
          size >= 48 ? "text-lg" : "text-[11px]",
        )}
      >
        {score}
      </span>
    </span>
  );
}

function CategoryList({ categories }: { categories: BalanceCategory[] }) {
  return (
    <ul className="space-y-2.5">
      {categories.map((category) => {
        const share = category.max > 0 ? category.points / category.max : 0;
        return (
          <li key={category.id} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="font-bold text-brand-ink">{category.label}</span>
              <span className="shrink-0 font-semibold text-brand-secondary">
                {Math.round(category.points)}/{category.max}
              </span>
            </div>
            <span className="block h-1.5 overflow-hidden rounded-full bg-brand-track">
              <span
                className={cn(
                  "block h-full rounded-full",
                  share >= 0.75 ? "bg-brand-accent" : share >= 0.4 ? "bg-brand-orange" : "bg-brand-red",
                )}
                style={{ width: `${Math.max(share * 100, 3)}%` }}
              />
            </span>
            <p className="text-xs text-brand-secondary">{category.reason}</p>
          </li>
        );
      })}
    </ul>
  );
}

function ScoreHeader({
  score,
  label,
  note,
  open,
  onToggle,
  muted,
}: {
  score: number;
  label: string;
  note: string;
  open: boolean;
  onToggle: () => void;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        "flex w-full touch-manipulation items-center gap-3 text-left transition-transform active:scale-[0.99]",
        muted && "opacity-60",
      )}
    >
      <BalanceRing score={score} />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-brand-ink">{label}</span>
        <span className="block text-xs text-brand-secondary">{note}</span>
      </span>
      <ChevronDown className={cn("size-4 shrink-0 text-brand-tertiary transition-transform", open && "rotate-180")} />
    </button>
  );
}

const METHOD_LINK = (
  <a
    href="/ausgewogenheit"
    target="_blank"
    rel="noreferrer"
    className="inline-block text-xs font-semibold text-brand-accent-dark underline underline-offset-2"
  >
    So berechnen wir die Ausgewogenheit
  </a>
);

/**
 * The recipe's score with its reasons. Recipes without facts show nothing; facts
 * that no longer match the ingredients show greyed out until they are re-estimated.
 */
export function RecipeBalanceSection({ recipe }: { recipe: Pick<Recipe, "ingredients" | "serving_size" | "balance"> }) {
  const [open, setOpen] = useState(false);
  const state = getBalanceState(recipe);
  if (state.kind === "missing") return null;
  const result = scoreRecipe(state.balance);

  return (
    <section aria-label="Ausgewogenheit" className="space-y-3 rounded-[18px] bg-brand-stat-bg p-3.5">
      <ScoreHeader
        score={result.score}
        label={`Ausgewogenheit · ${result.label}`}
        note={state.kind === "stale" ? "Zutaten geändert – Wert ist veraltet" : "Pro Portion, Werte von der KI geschätzt"}
        open={open}
        onToggle={() => setOpen((value) => !value)}
        muted={state.kind === "stale"}
      />
      {open && (
        <div className="space-y-3 border-t border-brand-divider pt-3">
          <CategoryList categories={result.categories} />
          {METHOD_LINK}
        </div>
      )}
    </section>
  );
}

/**
 * Builds the week score from the planned meals. Eating out and recipes without
 * (current) facts can't be judged and are counted separately.
 */
export function getWeekBalance(plannedMeals: PlannedMeal[], recipesById: Map<string, Recipe>) {
  const scored: WeekBalanceMeal[] = [];
  let unscored = 0;

  for (const meal of plannedMeals) {
    const recipe = meal.recipe_id ? recipesById.get(meal.recipe_id) : undefined;
    if (!recipe) {
      if (meal.label) unscored += 1;
      continue;
    }
    const state = getBalanceState(recipe);
    if (state.kind === "ready") scored.push({ name: recipe.name, facts: state.balance });
    else unscored += 1;
  }

  return scoreWeek(scored, unscored);
}

export function WeekBalanceCard({
  plannedMeals,
  recipesById,
}: {
  plannedMeals: PlannedMeal[];
  recipesById: Map<string, Recipe>;
}) {
  const [open, setOpen] = useState(false);
  const week = useMemo(() => getWeekBalance(plannedMeals, recipesById), [plannedMeals, recipesById]);
  const unscoredNote =
    week.unscoredMeals > 0
      ? `${week.unscoredMeals} ${week.unscoredMeals === 1 ? "Mahlzeit" : "Mahlzeiten"} ohne Bewertung`
      : null;

  return (
    <section aria-label="Ausgewogenheit der Woche" className="space-y-3 rounded-[18px] bg-white px-4 py-3.5 ring-1 ring-brand-card-border">
      {week.kind === "too-few" ? (
        <div className="flex items-center gap-3">
          <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-brand-accent-bg text-brand-accent-dark">
            <Scale className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-bold text-brand-ink">Ausgewogenheit der Woche</span>
            <span className="block text-xs text-brand-secondary">
              Ab 3 bewerteten Rezepten gibt es hier einen Wert.
              {unscoredNote ? ` ${unscoredNote}.` : ""}
            </span>
          </span>
        </div>
      ) : (
        <>
          <ScoreHeader
            score={week.score}
            label={`Woche · ${week.label}`}
            note={[`Bezogen auf ${week.scoredMeals} Mahlzeiten`, unscoredNote].filter(Boolean).join(" · ")}
            open={open}
            onToggle={() => setOpen((value) => !value)}
          />
          {open && (
            <div className="space-y-3 border-t border-brand-divider pt-3">
              <CategoryList categories={week.categories} />
              <p className="text-xs text-brand-secondary">
                Ziele pro Person, angepasst an die Zahl der geplanten Mahlzeiten. Keine medizinische Beratung.
              </p>
              {METHOD_LINK}
            </div>
          )}
        </>
      )}
    </section>
  );
}
