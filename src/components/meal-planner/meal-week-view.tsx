"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient, getSessionUser } from "@/lib/supabase/client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { MealType, PlannedMeal, Recipe } from "@/types/database";
import { DayCard } from "./day-card";
import { WeekOverviewList, WeekSummary } from "./week-overview";
import { cn } from "@/lib/utils";
import { getCurrentWeekStartDateString } from "@/hooks/use-meal-plan-data";
import type { NutritionTargetSettings } from "./nutrition-target-settings";
import { DEFAULT_NUTRITION_TARGETS } from "./nutrition-target-settings";
import { MEAL_TYPE_LABELS } from "@/lib/meal-labels";
import toast from "react-hot-toast";

const DAYS = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
];

type ViewMode = "day" | "week";

const VIEW_MODE_STORAGE_KEY = "weekly-meal-planner:planner:view-mode";

const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: "day", label: "Tag" },
  { value: "week", label: "Woche" },
];

function getTodayDayIndex(): number {
  // JS getDay() is Sunday=0..Saturday=6; day_of_week in this app is Monday=0..Sunday=6.
  return (new Date().getDay() + 6) % 7;
}

interface MealWeekViewProps {
  recipes: Recipe[];
  plannedMeals: PlannedMeal[];
  loading: boolean;
  nutritionTargets?: NutritionTargetSettings;
  onDataChanged: () => void;
}

export function MealWeekView({
  recipes,
  plannedMeals,
  loading,
  nutritionTargets = DEFAULT_NUTRITION_TARGETS,
  onDataChanged,
}: MealWeekViewProps) {
  const [selectedDayIndex, setSelectedDayIndex] = useState(getTodayDayIndex);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const supabase = createClient();

  // Without a saved choice, keep the previous layout: one day on phones, the whole
  // week on desktop.
  useEffect(() => {
    let storedMode: string | null = null;
    try {
      storedMode = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    } catch {
      // Storage unavailable; fall back to the screen-size default.
    }

    if (storedMode === "day" || storedMode === "week") {
      setViewMode(storedMode);
    } else if (window.matchMedia("(min-width: 1024px)").matches) {
      setViewMode("week");
    }
  }, []);

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    } catch {
      // Storage unavailable; the toggle still works for this session.
    }
  };

  const recipesById = useMemo(
    () => new Map(recipes.map((recipe) => [recipe.id, recipe])),
    [recipes],
  );

  const plannedMealsByDay = useMemo(() => {
    const grouped = new Map<number, PlannedMeal[]>();

    for (const meal of plannedMeals) {
      const existing = grouped.get(meal.day_of_week) ?? [];
      existing.push(meal);
      grouped.set(meal.day_of_week, existing);
    }

    return grouped;
  }, [plannedMeals]);

  const handleRemoveMeal = async (mealId: string) => {
    try {
      const { error } = await supabase.from("planned_meals").delete().eq("id", mealId);

      if (error) throw error;

      toast.success("Entfernt");
      onDataChanged();
    } catch (err) {
      toast.error("Entfernen fehlgeschlagen");
      console.error(err);
    }
  };

  const handleDropRecipe = async (
    e: React.DragEvent<HTMLDivElement>,
    dayIndex: number,
    mealType: MealType,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const data = e.dataTransfer.getData("application/json");
      const { type, recipe } = JSON.parse(data);

      if (type !== "recipe") return;

      const user = await getSessionUser();

      if (!user) return;

      // Fixed slots hold exactly one meal; dropping onto a filled slot replaces it.
      // The 'extra' section holds unlimited meals, so drops there always add a new one.
      if (mealType !== "extra") {
        const existingMeal = plannedMealsByDay
          .get(dayIndex)
          ?.find((meal) => meal.meal_type === mealType);

        if (existingMeal) {
          await supabase.from("planned_meals").delete().eq("id", existingMeal.id);
        }
      }

      const dateStr = getCurrentWeekStartDateString();

      let mealPlanId: string;
      const { data: existingPlan } = await supabase
        .from("meal_plans")
        .select("id")
        .eq("user_id", user.id)
        .eq("week_start_date", dateStr)
        .single<{ id: string }>();

      if (existingPlan) {
        mealPlanId = existingPlan.id;
      } else {
        const { data: newPlan, error: createError } = await supabase
          .from("meal_plans")
          .insert({
            user_id: user.id,
            week_start_date: dateStr,
          })
          .select("id")
          .single<{ id: string }>();

        if (createError || !newPlan) throw createError;
        mealPlanId = newPlan.id;
      }

      const { error: mealError } = await supabase.from("planned_meals").insert({
        meal_plan_id: mealPlanId,
        recipe_id: recipe.id,
        day_of_week: dayIndex,
        meal_type: mealType,
        serving_size: 1,
      });

      if (mealError) throw mealError;

      toast.success(`${recipe.name} zu ${MEAL_TYPE_LABELS[mealType]} hinzugefügt`);
      onDataChanged();
    } catch (err) {
      console.error(err);
      toast.error("Hinzufügen fehlgeschlagen");
    }
  };

  if (loading) {
    return <div className="py-8 text-center">Lädt…</div>;
  }

  return (
    <div className="space-y-4">
      <div
        role="radiogroup"
        aria-label="Ansicht"
        className="mx-auto flex w-full max-w-xs gap-1 rounded-xl bg-brand-chip-neutral p-1 lg:mx-0"
      >
        {VIEW_MODES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={viewMode === value}
            onClick={() => changeViewMode(value)}
            className={cn(
              "flex-1 rounded-full px-3 py-1.5 text-sm font-medium text-brand-secondary transition-colors",
              viewMode === value && "bg-white text-brand-accent-dark shadow-sm",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {viewMode === "day" ? (
        // Single day card with prev/next pager
        <div className="mx-auto max-w-xl">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSelectedDayIndex((prev) => (prev + 6) % 7)}
              className="rounded-full p-2 hover:bg-brand-chip-neutral"
              aria-label="Vorheriger Tag"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="font-heading text-lg font-bold">{DAYS[selectedDayIndex]}</h2>
            <button
              type="button"
              onClick={() => setSelectedDayIndex((prev) => (prev + 1) % 7)}
              className="rounded-full p-2 hover:bg-brand-chip-neutral"
              aria-label="Nächster Tag"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <DayCard
            dayIndex={selectedDayIndex}
            fullWidth
            recipesById={recipesById}
            plannedMealsForDay={plannedMealsByDay.get(selectedDayIndex) ?? []}
            nutritionTargets={nutritionTargets}
            onRemoveMeal={handleRemoveMeal}
            onDropRecipe={handleDropRecipe}
          />

          <div className="mt-3 flex justify-center gap-1.5">
            {DAYS.map((day, index) => (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDayIndex(index)}
                aria-label={`Zu ${day} wechseln`}
                className={`size-1.5 rounded-full transition-colors ${
                  index === selectedDayIndex ? "bg-brand-accent" : "bg-brand-disabled"
                }`}
              />
            ))}
          </div>
        </div>
      ) : (
        <>
          <WeekSummary
            plannedMeals={plannedMeals}
            recipesById={recipesById}
            nutritionTargets={nutritionTargets}
          />

          {/* Mobile: compact list, tapping a day opens it in the day view */}
          <div className="lg:hidden">
            <WeekOverviewList
              days={DAYS}
              todayIndex={getTodayDayIndex()}
              plannedMealsByDay={plannedMealsByDay}
              recipesById={recipesById}
              nutritionTargets={nutritionTargets}
              onSelectDay={(dayIndex) => {
                setSelectedDayIndex(dayIndex);
                // Drilling into a day keeps the saved preference, so the
                // planner opens in the week view again next time.
                setViewMode("day");
              }}
            />
          </div>

          {/* Desktop: horizontally-scrollable row of day cards */}
          <div className="hidden gap-3 overflow-x-auto pb-2 lg:flex">
            {DAYS.map((day, index) => (
              <DayCard
                key={day}
                dayLabel={day}
                dayIndex={index}
                recipesById={recipesById}
                plannedMealsForDay={plannedMealsByDay.get(index) ?? []}
                nutritionTargets={nutritionTargets}
                onRemoveMeal={handleRemoveMeal}
                onDropRecipe={handleDropRecipe}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
