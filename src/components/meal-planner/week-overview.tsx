"use client";

import { ChevronRight, Flame, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { MEAL_TYPE_LABELS } from "@/lib/meal-labels";
import type { MealType, PlannedMeal, Recipe } from "@/types/database";
import type { NutritionTargetSettings } from "./nutrition-target-settings";
import { sumMealNutrition } from "./day-card";

const MEAL_TYPE_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack", "extra"];

const formatNumber = (value: number) =>
  value.toLocaleString("de-DE", { maximumFractionDigits: 0 });

interface WeekSummaryProps {
  plannedMeals: PlannedMeal[];
  recipesById: Map<string, Recipe>;
  nutritionTargets: NutritionTargetSettings;
}

/**
 * Week totals. Targets are set per day, so the week target is the daily target
 * times seven, and the per-day average is shown next to it for comparison.
 */
export function WeekSummary({
  plannedMeals,
  recipesById,
  nutritionTargets,
}: WeekSummaryProps) {
  const totals = sumMealNutrition(plannedMeals, recipesById);
  const plannedDayCount = new Set(plannedMeals.map((meal) => meal.day_of_week)).size;
  const averageCalories = plannedDayCount > 0 ? totals.calories / plannedDayCount : 0;
  const weekCaloriesTarget = nutritionTargets.calories_target * 7;

  return (
    <div className="rounded-[18px] bg-white px-4 py-3.5 ring-1 ring-brand-card-border">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div className="font-heading flex items-center gap-1.5 text-sm font-bold">
            <Flame className="h-4 w-4 text-brand-accent-dark" strokeWidth={2.5} />
            {formatNumber(totals.calories)}
            {nutritionTargets.calories_target_enabled
              ? `/${formatNumber(weekCaloriesTarget)}`
              : ""}{" "}
            kcal diese Woche
          </div>
          <p className="text-xs font-medium text-brand-secondary">
            Ø {formatNumber(averageCalories)} kcal/Tag
            {nutritionTargets.calories_target_enabled &&
              ` (Ziel ${formatNumber(nutritionTargets.calories_target)})`}
          </p>
        </div>
        {nutritionTargets.calories_target_enabled && weekCaloriesTarget > 0 && (
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-brand-track">
            <div
              className="h-full rounded-full bg-brand-accent"
              style={{
                width: `${Math.min((totals.calories / weekCaloriesTarget) * 100, 100)}%`,
              }}
            />
          </div>
        )}
        <div className="mt-1.5 flex flex-wrap gap-x-3 text-xs font-medium text-brand-accent-dark">
          {nutritionTargets.protein_target_enabled && (
            <span className="inline-flex items-center gap-1">
              <Zap className="h-3.5 w-3.5" />
              {formatNumber(totals.protein)}/
              {formatNumber(nutritionTargets.protein_target * 7)}g Protein
            </span>
          )}
          <span className="text-brand-secondary">
            {plannedDayCount}/7 Tage geplant
          </span>
        </div>
      </div>
    </div>
  );
}

interface WeekOverviewListProps {
  days: string[];
  todayIndex: number;
  plannedMealsByDay: Map<number, PlannedMeal[]>;
  recipesById: Map<string, Recipe>;
  nutritionTargets: NutritionTargetSettings;
  onSelectDay: (dayIndex: number) => void;
}

/**
 * Compact one-row-per-day list for small screens. Tapping a day opens it in
 * the day view, where meals can be added and removed.
 */
export function WeekOverviewList({
  days,
  todayIndex,
  plannedMealsByDay,
  recipesById,
  nutritionTargets,
  onSelectDay,
}: WeekOverviewListProps) {
  return (
    <ul className="space-y-2">
      {days.map((day, dayIndex) => {
        const meals = [...(plannedMealsByDay.get(dayIndex) ?? [])].sort(
          (a, b) =>
            MEAL_TYPE_ORDER.indexOf(a.meal_type) - MEAL_TYPE_ORDER.indexOf(b.meal_type),
        );
        const totals = sumMealNutrition(meals, recipesById);
        const showTarget =
          nutritionTargets.calories_target_enabled && nutritionTargets.calories_target > 0;

        return (
          <li key={day}>
            <button
              type="button"
              onClick={() => onSelectDay(dayIndex)}
              className={cn(
                "flex w-full touch-manipulation items-center gap-3 rounded-[18px] bg-white px-4 py-3 text-left ring-1 ring-brand-card-border transition-all hover:bg-brand-accent-bg-light active:scale-[0.98]",
                dayIndex === todayIndex && "ring-2 ring-brand-accent",
              )}
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-heading text-sm font-bold text-brand-ink">
                    {day}
                    {dayIndex === todayIndex && (
                      <span className="ml-1.5 text-xs font-semibold text-brand-accent-dark">
                        Heute
                      </span>
                    )}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-brand-accent-dark">
                    <Flame className="h-3.5 w-3.5" strokeWidth={2.5} />
                    {formatNumber(totals.calories)}
                    {showTarget && `/${formatNumber(nutritionTargets.calories_target)}`}
                  </span>
                </div>
                {showTarget && (
                  <div className="h-1 w-full overflow-hidden rounded-full bg-brand-track">
                    <div
                      className="h-full rounded-full bg-brand-accent"
                      style={{
                        width: `${Math.min(
                          (totals.calories / nutritionTargets.calories_target) * 100,
                          100,
                        )}%`,
                      }}
                    />
                  </div>
                )}
                {meals.length === 0 ? (
                  <p className="text-xs text-brand-tertiary">Nichts geplant</p>
                ) : (
                  <ul className="space-y-0.5">
                    {meals.map((meal) => {
                      const recipe = recipesById.get(meal.recipe_id);
                      if (!recipe) return null;

                      return (
                        <li key={meal.id} className="flex gap-1.5 text-xs">
                          <span className="w-20 shrink-0 text-brand-tertiary">
                            {MEAL_TYPE_LABELS[meal.meal_type]}
                          </span>
                          <span className="truncate font-medium text-brand-ink">
                            {recipe.name}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-brand-tertiary" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
