"use client";

import { useMemo, useState } from "react";
import {
  useActiveHousehold,
  useHouseholdRecipesQuery,
  useRecipesQuery,
  useUserId,
  type HouseholdRecipe,
} from "@/hooks/use-planner-data";
import { combineHouseholdRecipes, type RecipeAuthorFilter } from "@/lib/households";
import type { Recipe } from "@/types/database";
import { cn } from "@/lib/utils";
import { RecipeList } from "./recipe-list";
import { useShowNutrition } from "./nutrition-target-settings";
import { useShowBalance } from "./balance-display";

const sameFilter = (a: RecipeAuthorFilter, b: RecipeAuthorFilter) =>
  typeof a === "string" || typeof b === "string" ? a === b : a.userId === b.userId;

/**
 * The "Haushalt" tab: the user's own recipes together with the other members',
 * so search and filters work across all of them, and a choice of whose to
 * show. Others' recipes plan directly (also by dragging onto a day); changing
 * one needs a copy first, from the recipe page.
 */
export function HouseholdRecipes() {
  const userId = useUserId();
  const { household } = useActiveHousehold();
  const { data: own, isPending: ownPending } = useRecipesQuery();
  const { data: others, isPending: othersPending } = useHouseholdRecipesQuery();
  const showNutrition = useShowNutrition();
  const showBalance = useShowBalance();
  const [chosenAuthor, setAuthor] = useState<RecipeAuthorFilter>("all");
  // After switching households the chosen person may not be in this one.
  const author =
    typeof chosenAuthor === "string" || household?.members.some((member) => member.userId === chosenAuthor.userId)
      ? chosenAuthor
      : "all";

  const ownRecipes = own?.recipes;
  const otherRecipes = others;
  const recipes = useMemo(
    () => combineHouseholdRecipes<Recipe>(ownRecipes ?? [], otherRecipes ?? [], userId, author),
    [ownRecipes, otherRecipes, userId, author],
  );

  const tagsById = useMemo(() => {
    const tags: Record<string, string[]> = { ...(own?.tagsById ?? {}) };
    for (const recipe of otherRecipes ?? []) tags[recipe.id] = recipe.tags;
    return tags;
  }, [own?.tagsById, otherRecipes]);

  // Everyone in the household, in joining order; names come from the household
  // so members without recipes yet still show up.
  const chips: { filter: RecipeAuthorFilter; label: string }[] = [
    { filter: "all", label: "Alle" },
    { filter: "me", label: "Meine" },
    ...(household?.members ?? [])
      .filter((member) => member.userId !== userId)
      .map((member) => ({ filter: { userId: member.userId }, label: member.displayName || "Jemand" })),
  ];

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Rezepte von" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
        {chips.map((chip) => {
          const active = sameFilter(chip.filter, author);
          return (
            <button
              key={typeof chip.filter === "string" ? chip.filter : chip.filter.userId}
              type="button"
              onClick={() => setAuthor(chip.filter)}
              aria-pressed={active}
              className={cn(
                "flex h-8 max-w-[10rem] shrink-0 items-center rounded-full px-3 text-[13px] font-semibold transition-all active:scale-95",
                active ? "bg-brand-accent-dark text-white" : "bg-brand-chip-neutral text-brand-ink",
              )}
            >
              <span className="truncate">{chip.label}</span>
            </button>
          );
        })}
      </div>

      <RecipeList
        recipes={recipes}
        recipeTagsById={tagsById}
        loading={ownPending || othersPending}
        showNutrition={showNutrition}
        showBalance={showBalance}
        ownRecipes={false}
        emptyText={
          author === "all"
            ? "Noch keine Rezepte im Haushalt."
            : author === "me"
              ? "Du hast noch keine Rezepte."
              : "Diese Person hat noch keine Rezepte."
        }
        cardFooter={(recipe) => (
          <p className="truncate text-xs text-brand-tertiary">
            {recipe.user_id === userId ? "von dir" : `von ${(recipe as HouseholdRecipe).author_name || "jemandem"}`}
          </p>
        )}
      />
    </div>
  );
}
