"use client";

import { Plus } from "lucide-react";
import type { MealType } from "@/types/database";
import { MEAL_TYPE_LABELS } from "@/lib/meal-labels";
import { useScreenStack } from "./screen-stack";

interface AddMealButtonProps {
  dayOfWeek: number;
  mealType: MealType;
  label?: string;
  // Narrow desktop week column: smaller, without the round plus badge.
  compact?: boolean;
}

export function AddMealButton({
  dayOfWeek,
  mealType,
  label = MEAL_TYPE_LABELS[mealType],
  compact = false,
}: AddMealButtonProps) {
  const { openScreen } = useScreenStack();

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => openScreen({ kind: "add-meal", dayIndex: dayOfWeek, mealType })}
        aria-label={`${label} hinzufügen`}
        className="flex h-11 w-full touch-manipulation items-center justify-center gap-1 rounded-[14px] border-[1.5px] border-dashed border-[#cdd6d0] px-1.5 text-xs font-bold text-brand-tertiary transition-all duration-150 hover:border-brand-accent hover:text-brand-accent-dark active:scale-[0.98] active:bg-brand-accent-bg"
      >
        <Plus className="size-3.5 shrink-0" strokeWidth={3} />
        <span className="truncate">{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => openScreen({ kind: "add-meal", dayIndex: dayOfWeek, mealType })}
      aria-label={`${label} hinzufügen`}
      className="flex h-[52px] w-full touch-manipulation items-center justify-between rounded-2xl border-[1.5px] border-dashed border-[#cdd6d0] px-4 text-[13px] font-bold uppercase tracking-[0.06em] text-brand-tertiary transition-all duration-150 hover:border-brand-accent hover:text-brand-accent-dark active:scale-[0.98] active:bg-brand-accent-bg"
    >
      {label}
      <span className="flex size-7 items-center justify-center rounded-full bg-brand-accent-bg text-brand-accent-dark">
        <Plus className="size-3.5" strokeWidth={3} />
      </span>
    </button>
  );
}
