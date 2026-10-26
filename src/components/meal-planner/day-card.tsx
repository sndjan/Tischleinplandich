"use client";

import { useState } from "react";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddMealButton } from "./add-meal-screen";
import { MealSlotCard } from "./meal-slot-card";
import type { MealType, PlannedMeal, Recipe } from "@/types/database";
import type { NutritionTargetSettings } from "./nutrition-target-settings";

const FIXED_MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

/**
 * Calories and protein of the given planned meals, scaled by their serving size.
 */
export function sumMealNutrition(
  meals: PlannedMeal[],
  recipesById: Map<string, Recipe>,
): { calories: number; protein: number } {
  return meals.reduce(
    (acc, meal) => {
      const recipe = recipesById.get(meal.recipe_id);
      if (!recipe) return acc;

      const multiplier = meal.serving_size || 1;

      return {
        calories: acc.calories + (recipe.calories ?? 0) * multiplier,
        protein: acc.protein + (recipe.protein ?? 0) * multiplier,
      };
    },
    { calories: 0, protein: 0 },
  );
}

interface DayCardProps {
  // Omitted on mobile, where the day pager above the card already shows the day.
  dayLabel?: string;
  dayIndex: number;
  // Fill the available width instead of the fixed desktop column width.
  fullWidth?: boolean;
  recipesById: Map<string, Recipe>;
  plannedMealsForDay: PlannedMeal[];
  nutritionTargets: NutritionTargetSettings;
  onRemoveMeal: (mealId: string) => void;
  onDropRecipe: (
    event: React.DragEvent<HTMLDivElement>,
    dayIndex: number,
    mealType: MealType,
  ) => void;
}

export function DayCard({
  dayLabel,
  dayIndex,
  fullWidth = false,
  recipesById,
  plannedMealsForDay,
  nutritionTargets,
  onRemoveMeal,
  onDropRecipe,
}: DayCardProps) {
  const [dragOverSlot, setDragOverSlot] = useState<MealType | null>(null);

  const totals = sumMealNutrition(plannedMealsForDay, recipesById);

  const extraMeals = plannedMealsForDay.filter(
    (meal) => meal.meal_type === "extra",
  );

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
        "rounded-xl transition-colors",
        dragOverSlot === mealType && "bg-blue-50/40 ring-2 ring-blue-300",
      )}
    >
      {content}
    </div>
  );

  return (
    <div
      className={cn(
        "w-full shrink-0 space-y-3 rounded-2xl bg-white p-3 ring-1 ring-brand-card-border",
        !fullWidth && "lg:w-72",
      )}
    >
      {dayLabel && (
        <h3 className="font-heading text-center text-sm font-bold uppercase tracking-wide text-brand-muted">
          {dayLabel}
        </h3>
      )}

      <div className="rounded-xl bg-brand-stat-bg p-3">
        <div className="font-heading flex items-center gap-1.5 text-sm font-bold">
          <Flame className="h-4 w-4 text-brand-accent-dark" strokeWidth={2.5} />
          {totals.calories.toFixed(0)}
          {nutritionTargets.calories_target_enabled
            ? `/${nutritionTargets.calories_target.toFixed(0)}`
            : ""}{" "}
          kcal
        </div>
        {nutritionTargets.calories_target_enabled && (
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-brand-track">
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
        {nutritionTargets.protein_target_enabled && (
          <p className="mt-1.5 text-xs font-medium text-brand-accent-dark">
            {totals.protein.toFixed(0)}/
            {nutritionTargets.protein_target.toFixed(0)}g Protein
          </p>
        )}
      </div>

      {FIXED_MEAL_TYPES.map((mealType) => {
        const meal = plannedMealsForDay.find((m) => m.meal_type === mealType);
        const recipe = meal ? recipesById.get(meal.recipe_id) : undefined;
        const isFilled = Boolean(meal && recipe);

        return (
          <div key={mealType} className="space-y-1">
            {renderDropZone(
              mealType,
              isFilled && meal && recipe ? (
                <MealSlotCard
                  recipe={recipe}
                  mealType={mealType}
                  servingSize={meal.serving_size}
                  nutritionTargets={nutritionTargets}
                  onRemove={() => onRemoveMeal(meal.id)}
                />
              ) : (
                <AddMealButton dayOfWeek={dayIndex} mealType={mealType} />
              ),
            )}
          </div>
        );
      })}

      <div className="space-y-1">
        {renderDropZone(
          "extra",
          <div className="space-y-2">
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
                  onRemove={() => onRemoveMeal(meal.id)}
                />
              );
            })}
            <AddMealButton dayOfWeek={dayIndex} mealType="extra" label="Extras" />
          </div>,
        )}
      </div>
    </div>
  );
}
