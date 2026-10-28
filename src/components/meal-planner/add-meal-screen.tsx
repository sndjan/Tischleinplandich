"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Check, Plus, Search, UtensilsCrossed } from "lucide-react";
import type { MealType, Recipe } from "@/types/database";
import { MEAL_TYPE_LABELS } from "@/lib/meal-labels";
import { useMealPlanData } from "@/hooks/use-planner-data";
import { useAddMeal } from "@/hooks/use-planner-mutations";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/controls";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SubPage } from "./sub-page";
import { useScreenStack } from "./screen-stack";
import { sumMealNutrition } from "./day-card";
import type { NutritionTargetSettings } from "./nutrition-target-settings";

export const WEEK_DAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

const RECENT_STORAGE_KEY = "weekly-meal-planner:add-meal:recent";
const MAX_RECENT = 20;

// Tags that usually mean "this is a recipe for this meal".
const MEAL_TYPE_TAGS: Record<MealType, string[]> = {
  breakfast: ["frühstück", "breakfast"],
  lunch: ["mittagessen", "mittag", "lunch"],
  dinner: ["abendessen", "abend", "dinner"],
  snack: ["snack", "snacks"],
  extra: [],
};

function readRecent(): string[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(RECENT_STORAGE_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Remembers recipes that were just planned, so "Zuletzt" can offer them first.
 */
export function rememberPlannedRecipe(recipeId: string) {
  try {
    const next = [recipeId, ...readRecent().filter((id) => id !== recipeId)].slice(0, MAX_RECENT);
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable; "Zuletzt" just stays empty.
  }
}

const formatNumber = (value: number) => Math.round(value).toLocaleString("de-DE");

interface AddMealButtonProps {
  dayOfWeek: number;
  mealType: MealType;
  label?: string;
}

export function AddMealButton({
  dayOfWeek,
  mealType,
  label = MEAL_TYPE_LABELS[mealType],
}: AddMealButtonProps) {
  const { openScreen } = useScreenStack();

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

type Filter = { kind: "all" } | { kind: "fits" } | { kind: "recent" } | { kind: "tag"; tag: string };

interface AddMealScreenProps {
  dayOfWeek: number;
  mealType: MealType;
  nutritionTargets: NutritionTargetSettings;
  onBack: () => void;
  onMealAdded: () => void;
}

export function AddMealScreen({
  dayOfWeek,
  mealType,
  nutritionTargets,
  onBack,
  onMealAdded,
}: AddMealScreenProps) {
  const { recipes, tagsById, plannedMeals, loading } = useMealPlanData();
  const addMeal = useAddMeal();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [servings, setServings] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>({ kind: "all" });
  const [recent] = useState(readRecent);

  const recipesById = useMemo(() => new Map(recipes.map((recipe) => [recipe.id, recipe])), [recipes]);

  // What is still free on that day, so recipes that fit can be pointed out.
  const remaining = useMemo(() => {
    const planned = sumMealNutrition(
      plannedMeals.filter((meal) => meal.day_of_week === dayOfWeek),
      recipesById,
    );
    const show = nutritionTargets.show_nutrition;
    return {
      calories:
        show && nutritionTargets.calories_target_enabled ? nutritionTargets.calories_target - planned.calories : null,
      protein:
        show && nutritionTargets.protein_target_enabled ? nutritionTargets.protein_target - planned.protein : null,
    };
  }, [plannedMeals, dayOfWeek, recipesById, nutritionTargets]);

  const fits = (recipe: Recipe) =>
    remaining.calories !== null &&
    remaining.calories > 0 &&
    recipe.calories != null &&
    recipe.calories * servings <= remaining.calories + 50 &&
    // Big enough to matter for the day, not just a snack that fits anywhere.
    recipe.calories * servings >= Math.min(remaining.calories * 0.4, 400);

  const mealTags = MEAL_TYPE_TAGS[mealType];

  const tagChips = useMemo(() => {
    const all = [...new Set(Object.values(tagsById).flat())];
    // Tags for this meal first ("Abendessen" when adding dinner), then by use.
    const count = (tag: string) => Object.values(tagsById).filter((tags) => tags.includes(tag)).length;
    return all
      .sort((a, b) => {
        const aMeal = mealTags.includes(a.toLowerCase()) ? 1 : 0;
        const bMeal = mealTags.includes(b.toLowerCase()) ? 1 : 0;
        return bMeal - aMeal || count(b) - count(a) || a.localeCompare(b, "de");
      })
      .slice(0, 8);
  }, [tagsById, mealTags]);

  const visibleRecipes = useMemo(() => {
    const query = search.trim().toLowerCase();
    const recentRank = new Map(recent.map((id, index) => [id, index]));

    const matches = recipes.filter((recipe) => {
      const tags = tagsById[recipe.id] ?? [];
      if (query && ![recipe.name, recipe.ingredients, tags.join(" ")].join(" ").toLowerCase().includes(query)) {
        return false;
      }
      if (filter.kind === "fits") return fits(recipe);
      if (filter.kind === "recent") return recentRank.has(recipe.id);
      if (filter.kind === "tag") return tags.includes(filter.tag);
      return true;
    });

    const score = (recipe: Recipe) => {
      const tags = (tagsById[recipe.id] ?? []).map((tag) => tag.toLowerCase());
      return (fits(recipe) ? 2 : 0) + (tags.some((tag) => mealTags.includes(tag)) ? 1 : 0);
    };

    return matches.sort((a, b) => {
      if (filter.kind === "recent") return recentRank.get(a.id)! - recentRank.get(b.id)!;
      return score(b) - score(a) || (recentRank.get(a.id) ?? 99) - (recentRank.get(b.id) ?? 99);
    });
    // fits() depends on servings and remaining, both listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipes, tagsById, search, filter, recent, servings, remaining, mealTags]);

  const handleAdd = () => {
    if (!selectedId) return;
    if (navigator.vibrate) navigator.vibrate(10);
    rememberPlannedRecipe(selectedId);
    // The meal shows up in the plan right away; saving continues in the background.
    addMeal({ recipeId: selectedId, dayIndex: dayOfWeek, mealType, servingSize: servings });
    onMealAdded();
  };

  const chips: { key: string; label: string; filter: Filter }[] = [
    { key: "all", label: "Alle", filter: { kind: "all" } },
    ...(remaining.calories !== null ? [{ key: "fits", label: "Passt heute", filter: { kind: "fits" } as Filter }] : []),
    ...(recent.length > 0 ? [{ key: "recent", label: "Zuletzt", filter: { kind: "recent" } as Filter }] : []),
    ...tagChips.map((tag) => ({ key: `tag-${tag}`, label: tag, filter: { kind: "tag", tag } as Filter })),
  ];
  const filterKey = filter.kind === "tag" ? `tag-${filter.tag}` : filter.kind;

  const subtitle =
    remaining.calories !== null
      ? remaining.calories > 0
        ? `Noch ${formatNumber(remaining.calories)} kcal${
            remaining.protein !== null && remaining.protein > 0 ? ` und ${formatNumber(remaining.protein)} g Protein` : ""
          } frei`
        : "Tagesziel schon erreicht"
      : undefined;

  return (
    <SubPage
      title={`${MEAL_TYPE_LABELS[mealType]} · ${WEEK_DAYS[dayOfWeek] ?? dayOfWeek}`}
      subtitle={subtitle}
      onBack={onBack}
      headerExtra={
        <div className="space-y-2.5">
          <label className="flex h-11 items-center gap-2 rounded-xl bg-brand-chip-neutral px-3">
            <Search className="size-4 text-brand-secondary" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rezept suchen"
              aria-label="Rezept suchen"
              type="search"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-brand-ink outline-none placeholder:text-brand-muted"
            />
          </label>
          <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 [scrollbar-width:none]">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setFilter(chip.filter)}
                aria-pressed={filterKey === chip.key}
                className={cn(
                  "h-8 shrink-0 rounded-full px-3 text-[13px] font-semibold transition-all active:scale-95",
                  filterKey === chip.key
                    ? "bg-brand-accent-dark font-bold text-white"
                    : "bg-brand-chip-neutral text-brand-ink",
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      }
      footer={
        <div className="flex items-center gap-2.5">
          <Stepper value={servings} onChange={setServings} min={0.5} max={12} step={0.5} label="Portionen" />
          <Button
            onClick={handleAdd}
            disabled={!selectedId}
            className="h-[52px] flex-1 rounded-[14px] text-base font-bold"
          >
            {servings === 1 ? "Hinzufügen" : `${servings.toLocaleString("de-DE")} Portionen hinzufügen`}
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Lädt">
          {[0, 1, 2, 3, 4].map((index) => (
            <Skeleton key={index} className="h-[72px] rounded-2xl" />
          ))}
        </div>
      ) : visibleRecipes.length === 0 ? (
        <p className="py-10 text-center text-sm text-brand-secondary">
          {recipes.length === 0 ? "Noch keine Rezepte" : "Nichts gefunden"}
        </p>
      ) : (
        <ul className="-mt-2">
          {visibleRecipes.map((recipe) => {
            const selected = recipe.id === selectedId;
            const recipeFits = fits(recipe);
            const badge = recipeFits
              ? { label: "Passt gut", className: "bg-brand-accent-bg text-brand-accent-dark" }
              : recent.includes(recipe.id)
                ? { label: "Zuletzt geplant", className: "bg-brand-chip-neutral text-brand-secondary" }
                : null;
            const facts = [
              nutritionTargets.show_nutrition &&
                recipe.calories != null &&
                `${formatNumber(recipe.calories * servings)} kcal`,
              nutritionTargets.show_nutrition &&
                recipe.protein != null &&
                `${formatNumber(recipe.protein * servings)} g Protein`,
              recipe.prep_time,
            ].filter(Boolean);

            return (
              <li key={recipe.id} className="border-b border-brand-divider last:border-b-0">
                <button
                  type="button"
                  onClick={() => setSelectedId(selected ? null : recipe.id)}
                  aria-pressed={selected}
                  aria-label={`${recipe.name} auswählen`}
                  className="flex w-full touch-manipulation items-center gap-3 py-2.5 text-left transition-transform active:scale-[0.98]"
                >
                  <span className="flex size-[60px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-chip-neutral">
                    {recipe.image_url ? (
                      <Image src={recipe.image_url} alt="" width={120} height={120} className="h-full w-full object-cover" unoptimized />
                    ) : (
                      <UtensilsCrossed className="size-6 text-brand-muted" />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-bold text-brand-ink">{recipe.name}</span>
                    {facts.length > 0 && <span className="truncate text-[13px] text-brand-secondary">{facts.join(" · ")}</span>}
                    {badge && (
                      <span className={cn("self-start rounded-md px-1.5 py-0.5 text-[11px] font-bold", badge.className)}>
                        {badge.label}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full transition-all duration-150",
                      selected ? "bg-brand-accent-dark text-white" : "border-2 border-brand-disabled",
                    )}
                  >
                    {selected && <Check className="size-4 animate-pop-in" strokeWidth={3} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </SubPage>
  );
}
