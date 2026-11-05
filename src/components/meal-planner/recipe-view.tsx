"use client";

import { useState } from "react";
import { CalendarPlus, ChefHat, ChevronLeft, Copy, Loader2, Pencil, Share2, ShoppingCart, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import type { Recipe } from "@/types/database";
import { useRecipesQuery, useUserId, type HouseholdRecipe } from "@/hooks/use-planner-data";
import { findOwnCopy, useSaveSharedRecipe } from "@/lib/recipe-sharing";
import { SharedByLine } from "./shared-recipe-screen";
import { HeroButton, RecipeBody } from "./recipe-body";
import { PlanRecipeSheet } from "./plan-recipe-sheet";
import { AddToListSheet } from "./add-to-list-sheet";
import { ShareRecipeSheet } from "./share-recipe-sheet";
import { StarRating, useRateRecipe } from "./star-rating";
import { useShowNutrition } from "./nutrition-target-settings";
import { RecipeBalanceSection, useShowBalance } from "./balance-display";

interface RecipeViewProps {
  recipe: Recipe;
  tags: string[];
  // Servings to start with, e.g. how many were planned for this meal.
  initialServings?: number;
  onBack: () => void;
  onEdit: (recipe: Recipe) => void;
  onDelete: (recipe: Recipe) => void;
  onCook: (recipe: Recipe, servings: number) => void;
  // Another member's recipe was copied (or already had a copy): show that one.
  onOpenCopy: (copy: Recipe) => void;
}

export function RecipeView({
  recipe: initialRecipe,
  tags,
  initialServings,
  onBack,
  onEdit,
  onDelete,
  onCook,
  onOpenCopy,
}: RecipeViewProps) {
  // Follow the cached copy, so a new share link shows up without reopening.
  const { data } = useRecipesQuery();
  const userId = useUserId();
  const recipe = data?.recipes.find((candidate) => candidate.id === initialRecipe.id) ?? initialRecipe;
  // Another member's recipe in a shared household: read, plan and cook it;
  // changing it (also with AI) needs an own copy first.
  const isOwn = !userId || recipe.user_id === userId;
  const saveCopy = useSaveSharedRecipe();
  const [copying, setCopying] = useState(false);
  const baseServings = recipe.serving_size > 0 ? recipe.serving_size : 1;
  const [servings, setServings] = useState(initialServings ?? baseServings);
  const [sheet, setSheet] = useState<"plan" | "share" | "list" | null>(null);
  const rateRecipe = useRateRecipe();
  const showNutrition = useShowNutrition();
  const showBalance = useShowBalance();

  const openCopy = async () => {
    if (copying) return;
    const member = recipe as HouseholdRecipe;
    const source = { ...member, tags, author_name: member.author_name ?? null };
    const existing = findOwnCopy(source, data?.recipes ?? []);
    if (existing) {
      onOpenCopy(existing);
      return;
    }

    setCopying(true);
    try {
      const copy = await saveCopy(source);
      toast.success("In deinen Rezepten gespeichert, jetzt kannst du sie ändern");
      onOpenCopy(copy);
    } catch (error) {
      console.error(error);
      toast.error("Speichern fehlgeschlagen");
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <div className="flex-1">
        <RecipeBody
          recipe={recipe}
          tags={tags}
          servings={servings}
          onServingsChange={setServings}
          showNutrition={showNutrition}
          balance={showBalance && <RecipeBalanceSection recipe={recipe} />}
          rating={
            isOwn ? (
              <StarRating value={recipe.rating ?? null} onChange={(value) => void rateRecipe(recipe, value)} />
            ) : undefined
          }
          attribution={isOwn ? undefined : <SharedByLine name={(recipe as HouseholdRecipe).author_name ?? null} />}
          heroActions={
            <>
              <HeroButton label="Zurück" onClick={onBack}>
                <ChevronLeft className="size-6" />
              </HeroButton>
              {isOwn ? (
                <div className="flex gap-2">
                  <HeroButton label="Auf die Einkaufsliste" onClick={() => setSheet("list")}>
                    <ShoppingCart className="size-[18px]" />
                  </HeroButton>
                  <HeroButton label="Teilen" onClick={() => setSheet("share")}>
                    <Share2 className="size-[18px]" />
                  </HeroButton>
                  <HeroButton label="Bearbeiten" onClick={() => onEdit(recipe)}>
                    <Pencil className="size-[18px]" />
                  </HeroButton>
                  <HeroButton label="Löschen" onClick={() => onDelete(recipe)} className="text-brand-red">
                    <Trash2 className="size-[18px]" />
                  </HeroButton>
                </div>
              ) : (
                <div className="flex gap-2">
                  <HeroButton label="Auf die Einkaufsliste" onClick={() => setSheet("list")}>
                    <ShoppingCart className="size-[18px]" />
                  </HeroButton>
                  <HeroButton label="Kopie in meine Rezepte speichern, um sie zu ändern" onClick={() => void openCopy()}>
                    {copying ? <Loader2 className="size-[18px] animate-spin" /> : <Copy className="size-[18px]" />}
                  </HeroButton>
                </div>
              )}
            </>
          }
        />
      </div>

      <footer className="sticky bottom-0 z-30 border-t border-brand-card-border bg-white shadow-[0_-6px_16px_rgba(28,43,34,0.06)]">
        <div className="mx-auto flex w-full max-w-2xl gap-2.5 px-4 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => setSheet("plan")}
            className="flex h-[52px] items-center gap-1.5 whitespace-nowrap rounded-[14px] border border-[#d9e6dc] bg-white px-4 text-[15px] font-bold text-brand-accent-dark transition-transform active:scale-[0.97] active:bg-brand-accent-bg"
          >
            <CalendarPlus className="size-[18px]" />
            Einplanen
          </button>
          <button
            type="button"
            onClick={() => onCook(recipe, servings)}
            className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[14px] bg-brand-accent-dark text-base font-bold text-white transition-transform active:scale-[0.97] active:bg-[#24633f]"
          >
            <ChefHat className="size-[18px]" />
            Kochen starten
          </button>
        </div>
      </footer>

      {sheet === "plan" && (
        <PlanRecipeSheet recipe={recipe} servings={servings} onClose={() => setSheet(null)} />
      )}
      {sheet === "share" && <ShareRecipeSheet recipe={recipe} onClose={() => setSheet(null)} />}
      {sheet === "list" && <AddToListSheet recipe={recipe} servings={servings} onClose={() => setSheet(null)} />}
    </div>
  );
}
