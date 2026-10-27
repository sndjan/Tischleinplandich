"use client";

import Image from "next/image";
import { Droplets, Flame, Wheat, X, Zap } from "lucide-react";
import type { MealType, Recipe } from "@/types/database";
import type { NutritionTargetSettings } from "./nutrition-target-settings";
import { MEAL_TYPE_LABELS } from "@/lib/meal-labels";
import { cn } from "@/lib/utils";
import { useScreenStack } from "./screen-stack";

interface MealSlotCardProps {
  recipe: Recipe;
  mealType: MealType;
  servingSize: number;
  nutritionTargets: NutritionTargetSettings;
  // Added a moment ago and still being saved.
  pending?: boolean;
  onRemove: () => void;
}

export function MealSlotCard({
  recipe,
  mealType,
  servingSize,
  nutritionTargets,
  pending = false,
  onRemove,
}: MealSlotCardProps) {
  const { openScreen } = useScreenStack();

  const openRecipePreview = () => openScreen({ kind: "recipe-preview", recipe });

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openRecipePreview}
      onKeyDown={(e) => {
        // Ignore keys bubbling up from the remove button.
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openRecipePreview();
        }
      }}
      className={cn(
        "group relative cursor-pointer rounded-xl bg-brand-accent-bg-light ring-1 ring-brand-accent/15 transition-all duration-150 hover:bg-brand-accent/10 active:scale-[0.98]",
        pending && "animate-fade-up",
      )}
    >
      {pending ? (
        <span
          role="status"
          aria-label="Wird gespeichert"
          title="Wird gespeichert"
          className="absolute right-3 top-3 size-2 animate-pulse rounded-full bg-brand-orange"
        />
      ) : (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute right-2 top-2 rounded-full p-1 opacity-100 transition-opacity hover:bg-black/5 sm:opacity-0 sm:group-hover:opacity-100"
        aria-label={`${recipe.name} entfernen`}
      >
        <X className="h-3.5 w-3.5 text-brand-tertiary" />
      </button>
      )}
      <div className="flex items-center gap-3 p-3">
        {recipe.image_url && (
          <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-brand-chip-neutral">
            <Image
              src={recipe.image_url}
              alt=""
              width={128}
              height={128}
              draggable={false}
              className="h-full w-full object-cover"
              unoptimized
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-secondary">
            {MEAL_TYPE_LABELS[mealType]}
          </p>
          <p
            className="truncate pr-5 text-sm font-semibold text-brand-ink"
            title={recipe.name}
          >
            {recipe.name}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-brand-secondary">
            {Boolean(recipe.calories) &&
              nutritionTargets.calories_target_enabled && (
                <span className="inline-flex items-center gap-1 text-brand-accent-dark font-bold">
                  <Flame
                    className="h-3.5 w-3.5 text-brand-accent-dark"
                    strokeWidth={2.5}
                  />
                  {((recipe.calories ?? 0) * servingSize).toFixed(0)}
                </span>
              )}
            {Boolean(recipe.protein) &&
              nutritionTargets.protein_target_enabled && (
                <span className="inline-flex items-center gap-1 text-brand-accent-dark font-bold">
                  <Zap className="h-3.5 w-3.5 text-brand-accent-dark" />
                  {((recipe.protein ?? 0) * servingSize).toFixed(0)}g
                </span>
              )}
            {Boolean(recipe.carbs) && nutritionTargets.carbs_target_enabled && (
              <span className="inline-flex items-center gap-1">
                <Wheat className="h-3.5 w-3.5 text-yellow-600" />
                {((recipe.carbs ?? 0) * servingSize).toFixed(0)}g
              </span>
            )}
            {Boolean(recipe.fats) && nutritionTargets.fats_target_enabled && (
              <span className="inline-flex items-center gap-1">
                <Droplets className="h-3.5 w-3.5 text-sky-500" />
                {((recipe.fats ?? 0) * servingSize).toFixed(0)}g
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
