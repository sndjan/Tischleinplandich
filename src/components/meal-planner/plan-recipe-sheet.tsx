"use client";

import { useMemo, useState } from "react";
import { CalendarPlus } from "lucide-react";
import toast from "react-hot-toast";
import type { MealType, Recipe } from "@/types/database";
import { MEAL_TYPE_LABELS } from "@/lib/meal-labels";
import { useMealPlanData } from "@/hooks/use-planner-data";
import { useAddMeal } from "@/hooks/use-planner-mutations";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Stepper } from "@/components/ui/controls";
import { cn } from "@/lib/utils";
import { rememberPlannedRecipe, WEEK_DAYS } from "./add-meal-screen";
import { WeekSwitcher } from "./meal-week-view";
import { useSelectedWeek } from "@/hooks/use-selected-week";
import { getMealRecipe } from "@/lib/planned-meal";

const SHORT_DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack", "extra"];

const getTodayIndex = () => (new Date().getDay() + 6) % 7;

// Tags hint at the meal: a recipe tagged "Frühstück" is planned for breakfast.
function guessMealType(tags: string[]): MealType {
  const lower = tags.map((tag) => tag.toLowerCase());
  if (lower.some((tag) => tag.includes("frühstück"))) return "breakfast";
  if (lower.some((tag) => tag.includes("mittag"))) return "lunch";
  if (lower.some((tag) => tag.includes("snack"))) return "snack";
  return "dinner";
}

/**
 * Puts a recipe into the selected week's plan from the recipe itself: pick a day and a
 * meal, and a meal already in that slot is replaced.
 */
export function PlanRecipeSheet({ recipe, onClose }: { recipe: Recipe; servings?: number; onClose: () => void }) {
  const { plannedMeals, recipes, tagsById } = useMealPlanData();
  const addMeal = useAddMeal();
  const { isCurrentWeek, label: weekLabel } = useSelectedWeek();
  // Switching the week here switches the planner too, so the plan shows where it went.
  const todayIndex = isCurrentWeek ? getTodayIndex() : -1;
  const [dayIndex, setDayIndex] = useState(getTodayIndex);
  const [mealType, setMealType] = useState<MealType>(() => guessMealType(tagsById[recipe.id] ?? []));
  const [portions, setPortions] = useState(1);

  const recipesById = useMemo(() => new Map(recipes.map((entry) => [entry.id, entry])), [recipes]);

  const replacedMeal =
    mealType === "extra"
      ? undefined
      : plannedMeals.find((meal) => meal.day_of_week === dayIndex && meal.meal_type === mealType);
  const replacedRecipe = replacedMeal ? getMealRecipe(replacedMeal, recipesById)?.recipe : undefined;

  const plan = () => {
    if (navigator.vibrate) navigator.vibrate(10);
    rememberPlannedRecipe(recipe.id);
    addMeal({
      recipeId: recipe.id,
      dayIndex,
      mealType,
      servingSize: portions,
      replaceMealId: replacedMeal?.id,
    });
    toast.success(
      `Für ${WEEK_DAYS[dayIndex]} · ${MEAL_TYPE_LABELS[mealType]} eingeplant${isCurrentWeek ? "" : ` (${weekLabel})`}`,
    );
    onClose();
  };

  return (
    <BottomSheet title="Einplanen" onClose={onClose}>
      <div className="space-y-5">
        <WeekSwitcher className="-mx-2 -mt-2" />
        <div className="grid grid-cols-7 gap-1" role="radiogroup" aria-label="Tag">
          {SHORT_DAYS.map((day, index) => {
            const filled = plannedMeals.some((meal) => meal.day_of_week === index);
            return (
              <button
                key={day}
                type="button"
                role="radio"
                aria-checked={dayIndex === index}
                aria-label={WEEK_DAYS[index]}
                onClick={() => setDayIndex(index)}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-1 rounded-[14px] text-[13px] font-bold transition-all active:scale-95",
                  dayIndex === index ? "bg-brand-accent-dark text-white" : "bg-brand-chip-neutral text-brand-ink",
                  dayIndex !== index && index === todayIndex && "ring-2 ring-brand-accent",
                )}
              >
                {day}
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    filled ? (dayIndex === index ? "bg-white" : "bg-brand-accent") : "bg-transparent",
                  )}
                />
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Mahlzeit">
          {MEAL_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={mealType === type}
              onClick={() => setMealType(type)}
              className={cn(
                "h-10 rounded-full px-4 text-sm font-semibold transition-all active:scale-95",
                mealType === type ? "bg-brand-accent-dark font-bold text-white" : "bg-brand-chip-neutral text-brand-ink",
              )}
            >
              {type === "extra" ? "Extra" : MEAL_TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        <p className="min-h-5 text-[13px] text-brand-secondary">
          {replacedRecipe ? (
            <>
              Ersetzt <b className="text-brand-ink">{replacedRecipe.name}</b>
            </>
          ) : (
            "Der Platz ist noch frei."
          )}
        </p>

        <div className="flex items-center gap-2.5">
          <Stepper value={portions} onChange={setPortions} min={0.5} max={12} step={0.5} label="Portionen" />
          <button
            type="button"
            onClick={plan}
            className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[14px] bg-brand-accent-dark text-base font-bold text-white transition-transform active:scale-[0.97]"
          >
            <CalendarPlus className="size-[18px]" />
            {portions === 1 ? "Einplanen" : `${portions.toLocaleString("de-DE")} Portionen einplanen`}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
