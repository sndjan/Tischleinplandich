"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { Recipe } from "@/types/database";
import { useScreenStack } from "./screen-stack";
import {
  Flame,
  Info,
  Search,
  SlidersHorizontal,
  UtensilsCrossed,
  Zap,
} from "lucide-react";

type VisibilityFilter = "all" | "private" | "public";
type SortOption =
  | "newest"
  | "oldest"
  | "name-asc"
  | "name-desc"
  | "protein-desc";

const ALL_TAGS_FILTER_VALUE = "__all_tags__";

const formatNumber = (value: number | null) => {
  if (value === null) {
    return null;
  }

  return Number.isInteger(value)
    ? value.toString()
    : value.toFixed(1).replace(/\.0$/, "");
};

const getPrimaryNutritionItems = (recipe: Recipe) => {
  return [
    {
      label: "kcal",
      value: recipe.calories,
      suffix: "",
      Icon: Flame,
      iconClassName: "text-brand-accent-dark size-4 ",
      textClassName: "text-brand-accent-dark",
    },
    {
      label: "Protein",
      value: recipe.protein,
      suffix: "g",
      Icon: Zap,
      iconClassName: "text-brand-accent-dark size-4",
      textClassName: "text-brand-accent-dark",
    },
  ].filter((item) => item.value !== null);
};

interface RecipeListProps {
  recipes: Recipe[];
  recipeTagsById: Record<string, string[]>;
  loading: boolean;
  onRecipeSelect?: (recipe: Recipe) => void;
  // Clicking a card selects it instead of opening the recipe.
  selectionMode?: boolean;
  disableDrag?: boolean;
  selectedRecipeId?: string | null;
  toolbarActions?: React.ReactNode;
}

export function RecipeList({
  recipes,
  recipeTagsById,
  loading,
  onRecipeSelect,
  selectionMode = false,
  disableDrag = false,
  selectedRecipeId = null,
  toolbarActions,
}: RecipeListProps) {
  const { openScreen } = useScreenStack();
  const [searchQuery, setSearchQuery] = useState("");
  const [visibilityFilter, setVisibilityFilter] =
    useState<VisibilityFilter>("all");
  const [selectedTag, setSelectedTag] = useState<string>(ALL_TAGS_FILTER_VALUE);
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [showFilters, setShowFilters] = useState(false);

  const availableTags = useMemo(() => {
    const uniqueTags = new Set<string>();

    Object.values(recipeTagsById).forEach((tags) => {
      tags.forEach((tag) => uniqueTags.add(tag));
    });

    return Array.from(uniqueTags).sort((a, b) => a.localeCompare(b));
  }, [recipeTagsById]);

  const filteredRecipes = useMemo(() => {
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();

    const results = recipes.filter((recipe) => {
      const recipeTags = recipeTagsById[recipe.id] ?? [];

      if (visibilityFilter === "public" && !recipe.is_public) {
        return false;
      }

      if (visibilityFilter === "private" && recipe.is_public) {
        return false;
      }

      if (selectedTag !== ALL_TAGS_FILTER_VALUE) {
        const matchesTag = recipeTags.some((tag) => tag === selectedTag);
        if (!matchesTag) {
          return false;
        }
      }

      if (!normalizedSearchQuery) {
        return true;
      }

      const searchableText = [
        recipe.name,
        recipe.ingredients,
        recipe.preparation_steps ?? "",
        recipe.prep_time ?? "",
        recipeTags.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearchQuery);
    });

    return results.sort((a, b) => {
      if (sortOption === "newest") {
        return (
          (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0)
        );
      }

      if (sortOption === "oldest") {
        return (
          (Date.parse(a.created_at) || 0) - (Date.parse(b.created_at) || 0)
        );
      }

      if (sortOption === "name-asc") {
        return a.name.localeCompare(b.name);
      }

      if (sortOption === "name-desc") {
        return b.name.localeCompare(a.name);
      }

      return (b.protein ?? -1) - (a.protein ?? -1);
    });
  }, [
    recipes,
    recipeTagsById,
    searchQuery,
    visibilityFilter,
    selectedTag,
    sortOption,
  ]);

  useEffect(() => {
    if (
      selectedTag !== ALL_TAGS_FILTER_VALUE &&
      !availableTags.includes(selectedTag)
    ) {
      setSelectedTag(ALL_TAGS_FILTER_VALUE);
    }
  }, [availableTags, selectedTag]);

  const hasActiveFilters =
    visibilityFilter !== "all" ||
    selectedTag !== ALL_TAGS_FILTER_VALUE ||
    sortOption !== "newest";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-brand-chip-neutral px-3">
          <Search className="size-4 shrink-0 text-brand-secondary" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Suchen"
            aria-label="Rezepte suchen"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-brand-ink outline-none placeholder:text-brand-muted"
          />
        </label>
        <button
          type="button"
          onClick={() => setShowFilters((prev) => !prev)}
          aria-label="Filter umschalten"
          aria-expanded={showFilters}
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-chip-neutral text-brand-ink transition-transform active:scale-90",
            hasActiveFilters && "bg-brand-accent-bg text-brand-accent-dark ring-1 ring-brand-accent",
          )}
        >
          <SlidersHorizontal className="size-[18px]" />
        </button>
        {toolbarActions}
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Select
            value={visibilityFilter}
            onValueChange={(value: VisibilityFilter) =>
              setVisibilityFilter(value)
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Sichtbarkeit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="private">Privat</SelectItem>
              <SelectItem value="public">Öffentlich</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={selectedTag}
            onValueChange={(value) => setSelectedTag(value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TAGS_FILTER_VALUE}>Alle Tags</SelectItem>
              {availableTags.map((tag) => (
                <SelectItem key={tag} value={tag}>
                  {tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={sortOption}
            onValueChange={(value: SortOption) => setSortOption(value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Sortieren" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Neueste</SelectItem>
              <SelectItem value="oldest">Älteste</SelectItem>
              <SelectItem value="name-asc">Name (A-Z)</SelectItem>
              <SelectItem value="name-desc">Name (Z-A)</SelectItem>
              <SelectItem value="protein-desc">Protein</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2" aria-busy="true" aria-label="Lädt">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="overflow-hidden rounded-xl border border-brand-card-border bg-white">
              <Skeleton className="aspect-[4/3] w-full rounded-none" />
              <div className="space-y-2 p-2.5">
                <Skeleton className="h-3.5 w-4/5" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <p className="py-6 text-center text-sm text-brand-secondary">
          Noch keine Rezepte. Tippe auf „Neu“, um eins zu importieren oder schreiben zu lassen.
        </p>
      ) : filteredRecipes.length === 0 ? (
        <p className="text-sm text-brand-tertiary">
          Keine Treffer
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
          {filteredRecipes.map((recipe) => {
            const primaryNutritionItems = getPrimaryNutritionItems(recipe);
            const isSelected = selectedRecipeId === recipe.id;

            const openPreview = () =>
              openScreen({ kind: "recipe-preview", recipe });

            return (
              <div
                key={recipe.id}
                draggable={!disableDrag}
                onDragStart={(e) => {
                  if (disableDrag) {
                    return;
                  }

                  e.dataTransfer.effectAllowed = "copy";
                  e.dataTransfer.setData(
                    "application/json",
                    JSON.stringify({
                      type: "recipe",
                      recipe,
                    }),
                  );
                }}
                className={cn(
                  "group relative overflow-hidden rounded-2xl bg-white ring-1 transition-all duration-150 hover:shadow-md active:scale-[0.97]",
                  isSelected ? "ring-2 ring-brand-accent-dark" : "ring-brand-card-border",
                  disableDrag ? "cursor-pointer" : "cursor-move",
                )}
              >
                <button
                  type="button"
                  className="block w-full text-left"
                  aria-label={
                    selectionMode
                      ? `${recipe.name} auswählen`
                      : `${recipe.name} anzeigen`
                  }
                  aria-pressed={selectionMode ? isSelected : undefined}
                  onClick={() => {
                    onRecipeSelect?.(recipe);

                    if (!selectionMode) {
                      openPreview();
                    }
                  }}
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-brand-chip-neutral">
                    {recipe.image_url ? (
                      <Image
                        src={recipe.image_url}
                        alt=""
                        width={360}
                        height={270}
                        draggable={false}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <UtensilsCrossed className="size-8 text-brand-muted" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 p-2.5">
                    <h3
                      className="line-clamp-2 text-sm font-bold leading-tight text-brand-ink"
                      title={recipe.name}
                    >
                      {recipe.name}
                    </h3>

                    {primaryNutritionItems.length > 0 && (
                      <div className="flex flex-wrap gap-x-2 gap-y-1">
                        {primaryNutritionItems.map((item) => (
                          <div
                            key={item.label}
                            className={`inline-flex items-center gap-1 text-xs font-bold ${item.textClassName}`}
                          >
                            <item.Icon
                              className={item.iconClassName}
                              strokeWidth={2.5}
                            />
                            <span>
                              {formatNumber(item.value)}
                              {item.suffix}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </button>

                {selectionMode && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute right-1.5 top-1.5 rounded-full bg-white/90 shadow-sm hover:bg-white"
                    aria-label={`Details für ${recipe.name} anzeigen`}
                    onClick={openPreview}
                  >
                    <Info className="h-4 w-4 text-brand-ink" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
