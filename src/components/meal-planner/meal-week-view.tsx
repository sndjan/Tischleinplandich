"use client";

import { useEffect, useMemo, useState } from "react";
import type { MealType, PlannedMeal, Recipe } from "@/types/database";
import { DayCard } from "./day-card";
import { WeekAgenda, WeekSummary } from "./week-overview";
import { cn } from "@/lib/utils";
import { useAddMeal, useRemoveMeal } from "@/hooks/use-planner-mutations";
import { Skeleton } from "@/components/ui/skeleton";
import type { NutritionTargetSettings } from "./nutrition-target-settings";
import { DEFAULT_NUTRITION_TARGETS } from "./nutrition-target-settings";

const DAYS = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
];

export type ViewMode = "day" | "week";

const VIEW_MODE_STORAGE_KEY = "weekly-meal-planner:planner:view-mode";

export const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: "day", label: "Tag" },
  { value: "week", label: "Woche" },
];

/**
 * Day or week view, remembered per device. Without a saved choice: one day on
 * phones, the whole week on desktop.
 */
export function useViewMode() {
  const [viewMode, setViewMode] = useState<ViewMode>("day");

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

  const changeViewMode = (mode: ViewMode, remember = true) => {
    setViewMode(mode);
    if (!remember) return;
    try {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    } catch {
      // Storage unavailable; the toggle still works for this session.
    }
  };

  return [viewMode, changeViewMode] as const;
}

export function ViewModeToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Ansicht" className="flex h-9 rounded-full bg-brand-chip-neutral p-[3px]">
      {VIEW_MODES.map(({ value: mode, label }) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={value === mode}
          onClick={() => onChange(mode)}
          className={cn(
            "rounded-full px-3.5 text-[13px] font-bold text-brand-secondary transition-all active:scale-95",
            value === mode && "bg-white text-brand-ink shadow-[0_1px_3px_rgba(0,0,0,0.08)]",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function getTodayDayIndex(): number {
  // JS getDay() is Sunday=0..Saturday=6; day_of_week in this app is Monday=0..Sunday=6.
  return (new Date().getDay() + 6) % 7;
}

// Dates of this week's Monday..Sunday, for the day strip.
function getWeekDates() {
  const monday = new Date();
  monday.setDate(monday.getDate() - getTodayDayIndex());
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date.getDate();
  });
}

const SHORT_DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function getWeekRange() {
  const monday = new Date();
  monday.setDate(monday.getDate() - getTodayDayIndex());
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const format = (date: Date) =>
    date.toLocaleDateString("de-DE", { day: "numeric", month: "short" }).replace(/\.$/, "");
  return `${format(monday)} – ${format(sunday)}`;
}

interface MealWeekViewProps {
  recipes: Recipe[];
  plannedMeals: PlannedMeal[];
  loading: boolean;
  nutritionTargets?: NutritionTargetSettings;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode, remember?: boolean) => void;
}

export function MealWeekView({
  recipes,
  plannedMeals,
  loading,
  nutritionTargets = DEFAULT_NUTRITION_TARGETS,
  viewMode,
  onViewModeChange,
}: MealWeekViewProps) {
  const [selectedDayIndex, setSelectedDayIndex] = useState(getTodayDayIndex);
  const addMeal = useAddMeal();
  const todayIndex = getTodayDayIndex();
  const weekDates = useMemo(getWeekDates, []);
  const weekRange = useMemo(getWeekRange, []);

  // Drilling into a day keeps the saved preference, so the planner opens in
  // the week view again next time.
  const openDay = (dayIndex: number) => {
    setSelectedDayIndex(dayIndex);
    onViewModeChange("day", false);
    window.scrollTo({ top: 0 });
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

  const handleRemoveMeal = useRemoveMeal(recipesById);

  const handleDropRecipe = (
    e: React.DragEvent<HTMLDivElement>,
    dayIndex: number,
    mealType: MealType,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    let recipe: Recipe | undefined;
    try {
      const { type, recipe: droppedRecipe } = JSON.parse(
        e.dataTransfer.getData("application/json"),
      );
      if (type === "recipe") recipe = droppedRecipe;
    } catch {
      return;
    }

    if (!recipe) return;

    // Fixed slots hold exactly one meal; dropping onto a filled slot replaces it.
    // The 'extra' section holds unlimited meals, so drops there always add a new one.
    const replacedMeal =
      mealType === "extra"
        ? undefined
        : plannedMealsByDay.get(dayIndex)?.find((meal) => meal.meal_type === mealType);

    addMeal({
      recipeId: recipe.id,
      dayIndex,
      mealType,
      servingSize: 1,
      replaceMealId: replacedMeal?.id,
    });
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-xl space-y-2.5" aria-busy="true" aria-label="Lädt">
        <div className="grid grid-cols-7 gap-1">
          {SHORT_DAYS.map((day) => (
            <Skeleton key={day} className="h-[62px] rounded-[14px]" />
          ))}
        </div>
        <Skeleton className="h-[104px] rounded-[18px]" />
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-[86px] rounded-[18px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {viewMode === "day" ? (
        <div className="mx-auto max-w-xl space-y-2.5">
          <div role="tablist" aria-label="Tag" className="grid grid-cols-7 gap-1">
            {SHORT_DAYS.map((day, index) => {
              const selected = index === selectedDayIndex;
              const hasMeals = (plannedMealsByDay.get(index)?.length ?? 0) > 0;

              return (
                <button
                  key={day}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-label={`${DAYS[index]}${index === todayIndex ? ", heute" : ""}`}
                  onClick={() => setSelectedDayIndex(index)}
                  className={cn(
                    "flex h-[62px] touch-manipulation flex-col items-center justify-center gap-0.5 rounded-[14px] transition-all duration-150 active:scale-95",
                    selected
                      ? "bg-brand-accent-dark text-white shadow-[0_4px_12px_rgba(47,122,82,0.3)]"
                      : "bg-white text-brand-ink ring-1 ring-brand-card-border",
                    !selected && index === todayIndex && "ring-2 ring-brand-accent",
                  )}
                >
                  <span className={cn("text-[11px] font-semibold", selected ? "text-white/80" : "text-brand-secondary")}>
                    {day}
                  </span>
                  <span className="font-heading text-[17px] font-extrabold leading-none">{weekDates[index]}</span>
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      hasMeals ? (selected ? "bg-white" : "bg-brand-accent") : "bg-transparent",
                    )}
                  />
                </button>
              );
            })}
          </div>

          <DayCard
            key={selectedDayIndex}
            summaryTitle={DAYS[selectedDayIndex]}
            dayIndex={selectedDayIndex}
            isToday={selectedDayIndex === todayIndex}
            fullWidth
            recipesById={recipesById}
            plannedMealsForDay={plannedMealsByDay.get(selectedDayIndex) ?? []}
            nutritionTargets={nutritionTargets}
            onRemoveMeal={handleRemoveMeal}
            onDropRecipe={handleDropRecipe}
          />
        </div>
      ) : (
        <>
          <WeekSummary
            plannedMeals={plannedMeals}
            recipesById={recipesById}
            nutritionTargets={nutritionTargets}
            todayIndex={todayIndex}
            weekRange={weekRange}
            onSelectDay={openDay}
          />

          {/* Mobile: agenda; the date or "Planen" opens the day to add meals */}
          <div className="lg:hidden">
            <WeekAgenda
              todayIndex={todayIndex}
              weekDates={weekDates}
              plannedMealsByDay={plannedMealsByDay}
              recipesById={recipesById}
              nutritionTargets={nutritionTargets}
              onSelectDay={openDay}
            />
          </div>

          {/* Desktop: horizontally-scrollable row of day cards */}
          <div className="hidden gap-3 overflow-x-auto pb-2 lg:flex">
            {DAYS.map((day, index) => (
              <DayCard
                key={day}
                dayLabel={day}
                dayIndex={index}
                isToday={index === todayIndex}
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
