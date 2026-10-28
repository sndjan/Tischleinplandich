"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { AddMealButton } from "./add-meal-button";
import { DaySummary, sumMealNutrition } from "./day-summary";
import { MealSlotCard } from "./meal-slot-card";
import type { MealType, PlannedMeal, Recipe } from "@/types/database";
import type { NutritionTargetSettings } from "./nutrition-target-settings";
import { isPendingId } from "@/hooks/use-planner-data";

const FIXED_MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

interface DayCardProps {
  // Desktop columns show the day name and sit in their own white card; on
  // phones the day strip above already says which day it is.
  dayLabel?: string;
  // Title inside the summary card (phones), e.g. "Dienstag".
  summaryTitle?: string;
  dayIndex: number;
  isToday?: boolean;
  // Fill the available width instead of the fixed desktop column width.
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
        !fullWidth && "rounded-[22px] bg-brand-app-bg p-2.5 ring-1 ring-brand-card-border lg:w-72",
        !fullWidth && isToday && "ring-2 ring-brand-accent",
      )}
    >
      {dayLabel && (
        <h3 className="pt-1 text-center font-heading text-sm font-extrabold uppercase tracking-wide text-brand-secondary">
          {dayLabel}
          {isToday && <span className="ml-1 text-brand-accent-dark">· Heute</span>}
        </h3>
      )}

      <DaySummary title={summaryTitle} isToday={isToday} totals={totals} targets={nutritionTargets} />

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
