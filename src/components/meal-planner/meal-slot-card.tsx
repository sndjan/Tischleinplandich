"use client";

import Image from "next/image";
import { Droplets, Flame, Wheat, X, Zap } from "lucide-react";
import type { MealType, Recipe } from "@/types/database";
import type { NutritionTargetSettings } from "./nutrition-target-settings";
import { MEAL_TYPE_LABELS } from "@/lib/meal-labels";
import { createClient } from "@/lib/supabase/client";
import { useScreenStack } from "./screen-stack";

async function fetchRecipeTags(recipeId: string): Promise<string[]> {
  const { data, error } = await createClient()
    .from("recipe_tags")
    .select("tags(name)")
    .eq("recipe_id", recipeId);

  if (error) throw error;

  const tagNames = (data ?? [])
    .map((entry: any) =>
      Array.isArray(entry.tags)
        ? (entry.tags[0]?.name as string | undefined)
        : (entry.tags?.name as string | undefined),
    )
    .filter((name): name is string => Boolean(name));

  return [...new Set(tagNames)].sort((a, b) => a.localeCompare(b));
}

interface MealSlotCardProps {
  recipe: Recipe;
  mealType: MealType;
  servingSize: number;
  nutritionTargets: NutritionTargetSettings;
  onRemove: () => void;
}

export function MealSlotCard({
  recipe,
  mealType,
  servingSize,
  nutritionTargets,
  onRemove,
}: MealSlotCardProps) {
  const { openScreen } = useScreenStack();

  const openRecipePreview = async () => {
    let tags: string[] = [];
    try {
      tags = await fetchRecipeTags(recipe.id);
    } catch (err) {
      // Tags are optional in the preview; show the recipe without them.
      console.error(err);
    }
    openScreen({ kind: "recipe-preview", recipe, tags });
  };

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
      className="group relative cursor-pointer rounded-xl bg-brand-accent-bg-light ring-1 ring-brand-accent/15 transition-colors hover:bg-brand-accent/10"
    >
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
