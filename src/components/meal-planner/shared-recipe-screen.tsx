"use client";

import { useState } from "react";
import { Check, ChevronLeft, Loader2, Plus } from "lucide-react";
import type { SharedRecipe } from "@/lib/recipe-sharing";
import { cn } from "@/lib/utils";
import { HeroButton, RecipeBody } from "./recipe-view";
import { useSavedSharedRecipes } from "./discover-recipes";

export function SharedByLine({ name }: { name: string | null }) {
  return (
    <p className="flex items-center gap-1.5 text-[13px] text-brand-secondary">
      <span className="flex size-[22px] items-center justify-center rounded-full bg-brand-accent-bg font-heading text-[11px] font-extrabold text-brand-accent-dark">
        {(name || "?").charAt(0).toUpperCase()}
      </span>
      Geteilt von <b className="text-brand-ink">{name || "jemandem"}</b>
    </p>
  );
}

/**
 * Someone else's recipe from "Entdecken": read it, then save a copy.
 */
export function SharedRecipeScreen({ recipe, onBack }: { recipe: SharedRecipe; onBack: () => void }) {
  const [servings, setServings] = useState(recipe.serving_size > 0 ? recipe.serving_size : 1);
  const { savedIds, savingId, save } = useSavedSharedRecipes();
  const saved = savedIds.has(recipe.id);

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <div className="flex-1">
        <RecipeBody
          recipe={recipe}
          tags={recipe.tags}
          servings={servings}
          onServingsChange={setServings}
          attribution={<SharedByLine name={recipe.author_name} />}
          heroActions={
            <HeroButton label="Zurück" onClick={onBack}>
              <ChevronLeft className="size-6" />
            </HeroButton>
          }
        />
      </div>
      <footer className="sticky bottom-0 z-30 border-t border-brand-card-border bg-white shadow-[0_-6px_16px_rgba(28,43,34,0.06)]">
        <div className="mx-auto w-full max-w-2xl px-4 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={saved || savingId !== null}
            onClick={() => void save(recipe)}
            className={cn(
              "flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] text-base font-bold transition-all active:scale-[0.97]",
              saved ? "bg-brand-accent-bg text-brand-accent-dark" : "bg-brand-accent-dark text-white",
            )}
          >
            {savingId ? (
              <Loader2 className="size-[18px] animate-spin" />
            ) : saved ? (
              <Check className="size-[18px] animate-pop-in" strokeWidth={3} />
            ) : (
              <Plus className="size-[18px]" strokeWidth={2.6} />
            )}
            {saved ? "In deinen Rezepten" : "In meine Rezepte speichern"}
          </button>
        </div>
      </footer>
    </div>
  );
}
