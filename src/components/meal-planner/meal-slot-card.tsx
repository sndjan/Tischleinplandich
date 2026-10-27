"use client";

import Image from "next/image";
import { UtensilsCrossed, X } from "lucide-react";
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

const formatNumber = (value: number) => Math.round(value).toLocaleString("de-DE");

export function MealSlotCard({
  recipe,
  mealType,
  servingSize,
  nutritionTargets,
  pending = false,
  onRemove,
}: MealSlotCardProps) {
  const { openScreen } = useScreenStack();

  const openRecipe = () => openScreen({ kind: "recipe-preview", recipe, servings: servingSize });

  const facts = [
    recipe.calories != null && nutritionTargets.calories_target_enabled &&
      `${formatNumber(recipe.calories * servingSize)} kcal`,
    recipe.protein != null && nutritionTargets.protein_target_enabled &&
      `${formatNumber(recipe.protein * servingSize)} g Protein`,
    servingSize !== 1 && `${servingSize.toLocaleString("de-DE")} Portionen`,
  ].filter(Boolean);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openRecipe}
      onKeyDown={(e) => {
        // Ignore keys bubbling up from the remove button.
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openRecipe();
        }
      }}
      className={cn(
        "group relative flex cursor-pointer touch-manipulation items-center gap-3 rounded-[18px] bg-white p-2.5 ring-1 ring-brand-card-border transition-all duration-150 hover:ring-brand-accent/40 active:scale-[0.98]",
        pending && "animate-fade-up",
      )}
    >
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-chip-neutral">
        {recipe.image_url ? (
          <Image
            src={recipe.image_url}
            alt=""
            width={128}
            height={128}
            draggable={false}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : (
          <UtensilsCrossed className="size-6 text-brand-muted" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-brand-tertiary">
          {MEAL_TYPE_LABELS[mealType]}
        </p>
        <p className="truncate text-[15px] font-bold text-brand-ink" title={recipe.name}>
          {recipe.name}
        </p>
        {facts.length > 0 && (
          <p className="truncate text-[13px] font-semibold text-brand-accent-dark">{facts.join(" · ")}</p>
        )}
      </div>
      {pending ? (
        <span
          role="status"
          aria-label="Wird gespeichert"
          title="Wird gespeichert"
          className="mr-3 size-2 shrink-0 animate-pulse rounded-full bg-brand-orange"
        />
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-brand-muted transition-colors hover:bg-black/5 active:bg-black/5 lg:opacity-0 lg:group-hover:opacity-100"
          aria-label={`${recipe.name} entfernen`}
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
