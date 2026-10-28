"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { AddMealButton } from "./add-meal-screen";
import { MealSlotCard } from "./meal-slot-card";
import type { MealType, PlannedMeal, Recipe } from "@/types/database";
import type { NutritionTargetSettings } from "./nutrition-target-settings";
import { isPendingId } from "@/hooks/use-planner-data";

const FIXED_MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export type NutritionTotals = { calories: number; protein: number; carbs: number; fats: number };

/**
 * Nutrition of the given planned meals, scaled by their serving size.
 */
export function sumMealNutrition(
  meals: PlannedMeal[],
  recipesById: Map<string, Recipe>,
): NutritionTotals {
  return meals.reduce(
    (acc, meal) => {
      const recipe = recipesById.get(meal.recipe_id);
      if (!recipe) return acc;

      const multiplier = meal.serving_size || 1;

      return {
        calories: acc.calories + (recipe.calories ?? 0) * multiplier,
        protein: acc.protein + (recipe.protein ?? 0) * multiplier,
        carbs: acc.carbs + (recipe.carbs ?? 0) * multiplier,
        fats: acc.fats + (recipe.fats ?? 0) * multiplier,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fats: 0 },
  );
}

const formatNumber = (value: number) =>
  Math.round(value).toLocaleString("de-DE", { maximumFractionDigits: 0 });

const MACROS: { key: "protein" | "carbs" | "fats"; label: string; barClassName: string }[] = [
  { key: "protein", label: "Protein", barClassName: "bg-brand-accent-dark" },
  { key: "carbs", label: "Carbs", barClassName: "bg-[#9bbfa7]" },
  { key: "fats", label: "Fett", barClassName: "bg-[#9bbfa7]" },
];

/**
 * How much of the day's targets is planned: calories left, plus a small bar per
 * enabled macro.
 */
export function DaySummary({
  title,
  isToday,
  totals,
  targets,
}: {
  title?: string;
  isToday?: boolean;
  totals: NutritionTotals;
  targets: NutritionTargetSettings;
}) {
  const caloriesLeft = targets.calories_target - totals.calories;
  const macros = MACROS.filter(({ key }) => targets[`${key}_target_enabled` as const]);

  return (
    <section className="space-y-2.5 rounded-[18px] bg-white px-4 py-3.5 ring-1 ring-brand-card-border">
      <div className="flex items-baseline justify-between gap-2">
        {title && (
          <h2 className="font-heading text-lg font-extrabold text-brand-ink">
            {title}
            {isToday && <span className="ml-1.5 font-sans text-[13px] font-bold text-brand-accent-dark">· Heute</span>}
          </h2>
        )}
        <span className="ml-auto text-[13px] text-brand-secondary">
          {targets.calories_target_enabled ? (
            caloriesLeft >= 0 ? (
              <>
                <b className="text-[15px] text-brand-ink">{formatNumber(caloriesLeft)}</b> kcal übrig
              </>
            ) : (
              <>
                <b className="text-[15px] text-brand-warn">{formatNumber(-caloriesLeft)}</b> kcal drüber
              </>
            )
          ) : (
            <>
              <b className="text-[15px] text-brand-ink">{formatNumber(totals.calories)}</b> kcal geplant
            </>
          )}
        </span>
      </div>
      {targets.calories_target_enabled && (
        <div className="h-2 overflow-hidden rounded-full bg-brand-track">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              caloriesLeft >= 0 ? "bg-brand-accent" : "bg-brand-warn",
            )}
            style={{ width: `${Math.min((totals.calories / (targets.calories_target || 1)) * 100, 100)}%` }}
          />
        </div>
      )}
      {macros.length > 0 && (
        <div className="grid gap-2.5 text-xs text-brand-secondary" style={{ gridTemplateColumns: `repeat(${macros.length}, minmax(0, 1fr))` }}>
          {macros.map(({ key, label, barClassName }) => {
            const target = targets[`${key}_target` as const];
            return (
              <div key={key} className="space-y-1">
                <span className="block truncate">
                  <b className="text-brand-ink">{formatNumber(totals[key])}</b>/{formatNumber(target)} g {label}
                </span>
                <div className="h-1 overflow-hidden rounded-full bg-brand-track">
                  <div
                    className={cn("h-full rounded-full transition-[width] duration-500", barClassName)}
                    style={{ width: `${Math.min((totals[key] / (target || 1)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

interface DayCardProps {
  // Desktop columns show the day name and sit in their own white card; on
  // phones the day strip above already says which day it is.
  dayLabel?: string;
  // Title inside the summary card (phones), e.g. "Dienstag".
  summaryTitle?: string;
  dayIndex: number;
  isToday?: boolean;
  // Fill the available width without the desktop column's own card.
  fullWidth?: boolean;
  recipesById: Map<string, Recipe>;
  plannedMealsForDay: PlannedMeal[];
  nutritionTargets: NutritionTargetSettings;
  onRemoveMeal: (meal: PlannedMeal) => void;
  onDropRecipe: (
    event: React.DragEvent<HTMLDivElement>,
    dayIndex: number,
    mealType: MealType,
  ) => void;
}

export function DayCard({
  dayLabel,
  summaryTitle,
  dayIndex,
  isToday = false,
  fullWidth = false,
  recipesById,
  plannedMealsForDay,
  nutritionTargets,
  onRemoveMeal,
  onDropRecipe,
}: DayCardProps) {
  const [dragOverSlot, setDragOverSlot] = useState<MealType | null>(null);

  const totals = sumMealNutrition(plannedMealsForDay, recipesById);

  const extraMeals = plannedMealsForDay.filter((meal) => meal.meal_type === "extra");

  const renderDropZone = (mealType: MealType, content: React.ReactNode) => (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "copy";
        setDragOverSlot(mealType);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) {
          setDragOverSlot(null);
        }
      }}
      onDrop={(e) => {
        setDragOverSlot(null);
        onDropRecipe(e, dayIndex, mealType);
      }}
      className={cn(
        "rounded-[18px] transition-colors",
        dragOverSlot === mealType && "bg-brand-accent-bg ring-2 ring-brand-accent",
      )}
    >
      {content}
    </div>
  );

  return (
    <div
      className={cn(
        "w-full shrink-0 space-y-2.5",
        !fullWidth && "rounded-[22px] bg-brand-app-bg p-2.5 ring-1 ring-brand-card-border",
        !fullWidth && isToday && "ring-2 ring-brand-accent",
      )}
    >
      {dayLabel && (
        <h3 className="pt-1 text-center font-heading text-sm font-extrabold uppercase tracking-wide text-brand-secondary">
          {dayLabel}
          {isToday && <span className="ml-1 text-brand-accent-dark">· Heute</span>}
        </h3>
      )}

      {nutritionTargets.show_nutrition ? (
        <DaySummary title={summaryTitle} isToday={isToday} totals={totals} targets={nutritionTargets} />
      ) : (
        summaryTitle && (
          <h2 className="px-1 font-heading text-lg font-extrabold text-brand-ink">
            {summaryTitle}
            {isToday && <span className="ml-1.5 font-sans text-[13px] font-bold text-brand-accent-dark">· Heute</span>}
          </h2>
        )
      )}

      {FIXED_MEAL_TYPES.map((mealType) => {
        const meal = plannedMealsForDay.find((m) => m.meal_type === mealType);
        const recipe = meal ? recipesById.get(meal.recipe_id) : undefined;

        return (
          <div key={mealType}>
            {renderDropZone(
              mealType,
              meal && recipe ? (
                <MealSlotCard
                  recipe={recipe}
                  mealType={mealType}
                  servingSize={meal.serving_size}
                  nutritionTargets={nutritionTargets}
                  pending={isPendingId(meal.id)}
                  onRemove={() => onRemoveMeal(meal)}
                />
              ) : (
                <AddMealButton dayOfWeek={dayIndex} mealType={mealType} />
              ),
            )}
          </div>
        );
      })}

      {renderDropZone(
        "extra",
        <div className="space-y-2.5">
          {extraMeals.map((meal) => {
            const recipe = recipesById.get(meal.recipe_id);
            if (!recipe) return null;

            return (
              <MealSlotCard
                key={meal.id}
                recipe={recipe}
                mealType="extra"
                servingSize={meal.serving_size}
                nutritionTargets={nutritionTargets}
                pending={isPendingId(meal.id)}
                onRemove={() => onRemoveMeal(meal)}
              />
            );
          })}
          <AddMealButton dayOfWeek={dayIndex} mealType="extra" label="Extras" />
        </div>,
      )}
    </div>
  );
}
