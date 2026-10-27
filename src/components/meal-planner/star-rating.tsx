"use client";

import { Star } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { isMissingColumnError, queryKeys, useUserId, type RecipesData } from "@/hooks/use-planner-data";
import type { Recipe } from "@/types/database";
import { cn } from "@/lib/utils";

/**
 * Saves a recipe's own rating. It shows at once; a failed write puts the old
 * rating back.
 */
export function useRateRecipe() {
  const queryClient = useQueryClient();
  const userId = useUserId();

  return async (recipe: Recipe, rating: number | null) => {
    if (!userId) return;
    const key = queryKeys.recipes(userId);
    const setRating = (value: number | null) =>
      queryClient.setQueryData<RecipesData>(key, (data) =>
        data
          ? {
              ...data,
              recipes: data.recipes.map((entry) => (entry.id === recipe.id ? { ...entry, rating: value } : entry)),
            }
          : data,
      );

    const previous = recipe.rating ?? null;
    setRating(rating);

    const { error } = await createClient()
      .from("recipes")
      .update({ rating })
      .eq("id", recipe.id)
      .eq("user_id", userId);

    if (error) {
      setRating(previous);
      if (isMissingColumnError(error)) {
        toast("Bewertungen gibt es nach dem Datenbank-Update (Migration 012).");
      } else {
        console.error(error);
        toast.error("Bewertung konnte nicht gespeichert werden");
      }
    }
  };
}

/**
 * Five tappable stars. Tapping the current rating again clears it.
 */
export function StarRating({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Bewertung" className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = value !== null && star <= value;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} ${star === 1 ? "Stern" : "Sterne"}`}
            onClick={() => onChange(value === star ? null : star)}
            className="flex size-9 touch-manipulation items-center justify-center rounded-full transition-transform active:scale-75"
          >
            <Star
              // Re-mount on change so the newly filled star pops.
              key={filled ? "on" : "off"}
              className={cn(
                "size-6 transition-colors",
                filled ? "animate-pop-in fill-brand-orange text-brand-orange" : "text-brand-icon-muted",
              )}
              strokeWidth={2}
            />
          </button>
        );
      })}
    </div>
  );
}
