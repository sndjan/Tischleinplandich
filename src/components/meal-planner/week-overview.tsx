"use client";

import Image from "next/image";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { MEAL_TYPE_LABELS } from "@/lib/meal-labels";
import type { MealType, PlannedMeal, Recipe } from "@/types/database";
import type { NutritionTargetSettings } from "./nutrition-target-settings";
import { sumMealNutrition } from "./day-summary";
import { useScreenStack } from "./screen-stack";
import { RecipePlaceholder } from "./recipe-placeholder";
import { getMealRecipe } from "@/lib/planned-meal";

const MEAL_TYPE_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack", "extra"];
const SHORT_DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const CHART_HEIGHT_PX = 64;

const formatNumber = (value: number) =>
  Math.round(value).toLocaleString("de-DE", { maximumFractionDigits: 0 });

interface WeekSummaryProps {
  plannedMeals: PlannedMeal[];
  recipesById: Map<string, Recipe>;
  nutritionTargets: NutritionTargetSettings;
  todayIndex: number;
  // e.g. "26. Okt – 1. Nov"
  weekRange: string;
  onSelectDay: (dayIndex: number) => void;
}

/**
 * "Diese Woche": calories per day against the daily goal as small bars,
 * per-day averages over the days that have something planned, and the week's total.
 */
export function WeekSummary({
  plannedMeals,
  recipesById,
  nutritionTargets,
  todayIndex,
  weekRange,
  onSelectDay,
}: WeekSummaryProps) {
  const dayTotals = SHORT_DAYS.map((_, dayIndex) =>
    sumMealNutrition(
      plannedMeals.filter((meal) => meal.day_of_week === dayIndex),
      recipesById,
    ),
  );
  const plannedDays = dayTotals.filter((totals) => totals.calories > 0);
  const average = (key: "calories" | "protein") =>
    plannedDays.length > 0
      ? plannedDays.reduce((sum, totals) => sum + totals[key], 0) / plannedDays.length
      : 0;

  const showTarget = nutritionTargets.calories_target_enabled && nutritionTargets.calories_target > 0;
  // Bars are scaled to the goal, or to the biggest day when there is no goal.
  const scale = showTarget
    ? nutritionTargets.calories_target
    : Math.max(...dayTotals.map((totals) => totals.calories), 1);

  const weekCalories = dayTotals.reduce((sum, totals) => sum + totals.calories, 0);

  const stats = [
    { value: formatNumber(average("calories")), label: "Ø kcal / Tag" },
    { value: formatNumber(weekCalories), label: "kcal / Woche" },
    ...(nutritionTargets.protein_target_enabled
      ? [{ value: `${formatNumber(average("protein"))} g`, label: "Ø Protein / Tag", accent: true }]
      : []),
    { value: `${plannedDays.length}/7`, label: "Tage geplant" },
  ];

  return (
    <section className="space-y-3 rounded-[18px] bg-white px-4 pb-3 pt-3.5 ring-1 ring-brand-card-border">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-heading text-lg font-extrabold text-brand-ink">Diese Woche</h2>
        <span className="text-[13px] text-brand-secondary">{weekRange}</span>
      </div>

      <div className="relative flex gap-1 pr-14">
        {showTarget && (
          <>
            <span className="absolute inset-x-0 top-0 border-t-[1.5px] border-dashed border-[#b6c9bb]" />
            <span className="absolute right-0 top-1 bg-white pl-1 text-[10px] font-bold text-[#8aa594]">
              Ziel {formatNumber(nutritionTargets.calories_target)}
            </span>
          </>
        )}
        {dayTotals.map((totals, dayIndex) => {
          const isToday = dayIndex === todayIndex;
          const ratio = Math.min(totals.calories / scale, 1.15);
          const over = showTarget && totals.calories > nutritionTargets.calories_target * 1.05;

          return (
            <button
              key={SHORT_DAYS[dayIndex]}
              type="button"
              onClick={() => onSelectDay(dayIndex)}
              aria-label={`${SHORT_DAYS[dayIndex]}: ${formatNumber(totals.calories)} kcal`}
              className="flex flex-1 touch-manipulation flex-col items-center gap-1.5 transition-transform active:scale-95"
            >
              <span className="flex w-full items-end justify-center" style={{ height: CHART_HEIGHT_PX }}>
                <span
                  className={cn(
                    "w-[70%] max-w-[26px] rounded-md transition-[height] duration-500",
                    totals.calories === 0
                      ? "bg-brand-track"
                      : over
                        ? "bg-brand-warn"
                        : isToday
                          ? "bg-brand-accent-dark"
                          : "bg-brand-accent",
                  )}
                  style={{ height: totals.calories === 0 ? 4 : Math.max(6, ratio * CHART_HEIGHT_PX) }}
                />
              </span>
              <span
                className={cn(
                  "text-[11px]",
                  isToday ? "font-extrabold text-brand-accent-dark" : "font-semibold text-brand-tertiary",
                )}
              >
                {SHORT_DAYS[dayIndex]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Four tiles don't fit side by side on a phone, so they go two by two. */}
      <div className={cn("grid gap-2", stats.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3")}>
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl bg-brand-stat-bg px-2.5 py-2">
            <b className={cn("block text-base", stat.accent ? "text-brand-accent-dark" : "text-brand-ink")}>
              {stat.value}
            </b>
            <span className="block truncate text-[11px] text-brand-secondary">{stat.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

interface WeekAgendaProps {
  todayIndex: number;
  weekDates: number[];
  plannedMealsByDay: Map<number, PlannedMeal[]>;
  recipesById: Map<string, Recipe>;
  nutritionTargets: NutritionTargetSettings;
  onSelectDay: (dayIndex: number) => void;
}

/**
 * The week as an agenda for small screens: date on the left, the day's meals
 * on the right. Tapping a meal opens the recipe; the date or "Planen" opens the
 * day, where meals are added and removed.
 */
export function WeekAgenda({
  todayIndex,
  weekDates,
  plannedMealsByDay,
  recipesById,
  nutritionTargets,
  onSelectDay,
}: WeekAgendaProps) {
  const { openScreen } = useScreenStack();

  return (
    <ol className="space-y-2.5">
      {SHORT_DAYS.map((day, dayIndex) => {
        const isToday = dayIndex === todayIndex;
        const isPast = dayIndex < todayIndex;
        const meals = [...(plannedMealsByDay.get(dayIndex) ?? [])]
          .filter((meal) => getMealRecipe(meal, recipesById))
          .sort((a, b) => MEAL_TYPE_ORDER.indexOf(a.meal_type) - MEAL_TYPE_ORDER.indexOf(b.meal_type));
        const totals = sumMealNutrition(meals, recipesById);
        const left = nutritionTargets.calories_target - totals.calories;

        return (
          <li key={day} className={cn("flex gap-3", isPast && meals.length === 0 && "opacity-60")}>
            <button
              type="button"
              onClick={() => onSelectDay(dayIndex)}
              aria-label={`${day} ${weekDates[dayIndex]}. öffnen`}
              className="flex w-10 shrink-0 touch-manipulation flex-col items-center pt-2.5 transition-transform active:scale-90"
            >
              <span
                className={cn(
                  "text-[11px] font-bold",
                  isToday ? "text-brand-accent-dark" : "text-brand-tertiary",
                )}
              >
                {day}
              </span>
              <span
                className={cn(
                  "flex size-[34px] items-center justify-center rounded-full font-heading text-[17px] font-extrabold",
                  isToday ? "bg-brand-accent-dark text-white" : "text-brand-ink",
                )}
              >
                {weekDates[dayIndex]}
              </span>
            </button>

            <div
              className={cn(
                "min-w-0 flex-1 rounded-2xl px-3 py-1.5 ring-1 ring-brand-card-border",
                // Past days recede so today and the days ahead stand out.
                isPast ? "bg-brand-chip-neutral" : "bg-white",
              )}
            >
              {meals.length === 0 ? (
                <div className="flex items-center justify-between gap-2 py-1.5">
                  <span className="text-[13px] text-brand-tertiary">Nichts geplant</span>
                  <button
                    type="button"
                    onClick={() => onSelectDay(dayIndex)}
                    className="flex h-8 items-center gap-1 rounded-full bg-brand-accent-bg px-3 text-[13px] font-bold text-brand-accent-dark transition-transform active:scale-95"
                  >
                    <Plus className="size-3.5" strokeWidth={3} />
                    Planen
                  </button>
                </div>
              ) : (
                <>
                  {meals.map((meal) => {
                    const { recipe, isRecipe } = getMealRecipe(meal, recipesById)!;
                    return (
                      <button
                        key={meal.id}
                        type="button"
                        // Eating out has no recipe to open; the day has its details.
                        onClick={() =>
                          isRecipe
                            ? openScreen({ kind: "recipe-preview", recipe, servings: meal.serving_size })
                            : onSelectDay(dayIndex)
                        }
                        className="flex w-full touch-manipulation items-center gap-2.5 py-1.5 text-left transition-transform active:scale-[0.98]"
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-brand-chip-neutral">
                          {recipe.image_url ? (
                            <Image
                              src={recipe.image_url}
                              alt=""
                              width={80}
                              height={80}
                              className="h-full w-full object-cover"
                              unoptimized
                            />
                          ) : (
                            <RecipePlaceholder name={recipe.name} className="text-xl" />
                          )}
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="text-[10px] font-bold uppercase tracking-[0.05em] text-brand-tertiary">
                            {MEAL_TYPE_LABELS[meal.meal_type]}
                          </span>
                          <span className="truncate text-sm font-bold text-brand-ink">{recipe.name}</span>
                        </span>
                      </button>
                    );
                  })}
                  <div className="flex items-center justify-between gap-2 border-t border-brand-divider pb-0.5 pt-1.5">
                    <span className="text-[11px] text-brand-secondary">
                      {nutritionTargets.show_nutrition && (
                        <>
                          {formatNumber(totals.calories)} kcal
                          {nutritionTargets.calories_target_enabled &&
                            (left > 0 ? ` · noch ${formatNumber(left)} frei` : " · Ziel erreicht")}
                        </>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectDay(dayIndex)}
                      aria-label={`${day}: Mahlzeit hinzufügen`}
                      className="flex size-7 items-center justify-center rounded-full bg-brand-accent-bg text-brand-accent-dark transition-transform active:scale-90"
                    >
                      <Plus className="size-3.5" strokeWidth={3} />
                    </button>
                  </div>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
