"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { MealType, PlannedMeal, Recipe } from "@/types/database";
import { DayCard } from "./day-card";
import { WeekAgenda, WeekSummary } from "./week-overview";
import { WeekBalanceCard } from "./balance-display";
import { cn } from "@/lib/utils";
import { useAddMeal, useRemoveMeal } from "@/hooks/use-planner-mutations";
import { Skeleton } from "@/components/ui/skeleton";
import type { NutritionTargetSettings } from "./nutrition-target-settings";
import { DEFAULT_NUTRITION_TARGETS } from "./nutrition-target-settings";
import { useSelectedWeek } from "@/hooks/use-selected-week";
import { formatWeekRange, getDayIndex, getWeekDates } from "@/lib/week";

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

const SHORT_DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Steps between weeks; the label says which one the plan shows. */
export function WeekSwitcher({ className }: { className?: string }) {
  const { offset, setOffset, monday, label } = useSelectedWeek();
  const range = formatWeekRange(monday);

  const step = (delta: number) => {
    if (navigator.vibrate) navigator.vibrate(5);
    setOffset(offset + delta);
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        type="button"
        onClick={() => step(-1)}
        aria-label="Vorherige Woche"
        className="flex size-10 shrink-0 items-center justify-center rounded-full text-brand-secondary transition-transform active:scale-90 active:bg-black/5"
      >
        <ChevronLeft className="size-5" />
      </button>
      <div className="min-w-0 flex-1 text-center" aria-live="polite">
        <p className="truncate font-heading text-[15px] font-extrabold leading-tight text-brand-ink">{label}</p>
        {label !== range && <p className="truncate text-xs text-brand-secondary">{range}</p>}
      </div>
      {offset !== 0 && (
        <button
          type="button"
          onClick={() => setOffset(0)}
          className="h-8 shrink-0 rounded-full bg-brand-chip-neutral px-3 text-[13px] font-bold text-brand-ink transition-transform active:scale-95"
        >
          Heute
        </button>
      )}
      <button
        type="button"
        onClick={() => step(1)}
        aria-label="Nächste Woche"
        className="flex size-10 shrink-0 items-center justify-center rounded-full text-brand-secondary transition-transform active:scale-90 active:bg-black/5"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
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
  const { offset, monday } = useSelectedWeek();
  // Past weeks count as fully past, later weeks as not started yet.
  const todayIndex = offset === 0 ? getDayIndex(new Date()) : offset < 0 ? 7 : -1;
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => Math.max(0, Math.min(6, todayIndex)));
  const addMeal = useAddMeal();
  const weekDates = useMemo(() => getWeekDates(monday), [monday]);
  const weekRange = useMemo(() => formatWeekRange(monday), [monday]);

  // Another week opens on today if it is this week, else on Monday.
  useEffect(() => {
    setSelectedDayIndex(offset === 0 ? getDayIndex(new Date()) : 0);
  }, [offset]);

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
        <WeekSwitcher />
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
      <WeekSwitcher className={cn(viewMode === "day" && "mx-auto max-w-xl")} />
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
          {nutritionTargets.show_nutrition && (
            <WeekSummary
              plannedMeals={plannedMeals}
              recipesById={recipesById}
              nutritionTargets={nutritionTargets}
              todayIndex={todayIndex}
              weekRange={weekRange}
              onSelectDay={openDay}
            />
          )}

          {nutritionTargets.show_balance && (
            <WeekBalanceCard plannedMeals={plannedMeals} recipesById={recipesById} />
          )}

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

          {/* Desktop: the whole week in one row once there is room; narrower
              screens like an iPad wrap the days instead of scrolling sideways. */}
          <div className="hidden items-start gap-2 lg:grid lg:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] xl:grid-cols-7">
            {DAYS.map((day, index) => (
              <DayCard
                key={day}
                // Short, so the label fits a seventh of the width.
                dayLabel={`${SHORT_DAYS[index]} ${weekDates[index]}`}
                compact
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
