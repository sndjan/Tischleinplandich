"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Recipe } from "@/types/database";
import { useScreenStack } from "./screen-stack";
import {
  ExternalLink,
  Flame,
  Info,
  Pencil,
  SlidersHorizontal,
  Trash2,
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

const TAG_BADGE_CLASSNAME =
  "bg-brand-accent-bg text-brand-accent-dark rounded-full";

const formatNumber = (value: number | null) => {
  if (value === null) {
    return null;
  }

  return Number.isInteger(value)
    ? value.toString()
    : value.toFixed(1).replace(/\.0$/, "");
};

const RECIPE_TITLE_MAX_LENGTH = 30;

const truncateTitle = (name: string) =>
  name.length > RECIPE_TITLE_MAX_LENGTH
    ? `${name.slice(0, RECIPE_TITLE_MAX_LENGTH)}...`
    : name;

const getTextLines = (text: string | null) =>
  (text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

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

function TagBadges({ tags }: { tags: string[] }) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <Badge key={tag} variant="outline" className={TAG_BADGE_CLASSNAME}>
          <span className="truncate text-[11px] font-bold">{tag}</span>
        </Badge>
      ))}
    </div>
  );
}

export function RecipePreview({ recipe, tags }: { recipe: Recipe; tags: string[] }) {
  const ingredientLines = getTextLines(recipe.ingredients);
  const preparationLines = getTextLines(recipe.preparation_steps);
  const nutritionItems = [
    { label: "kcal", value: recipe.calories, suffix: "" },
    { label: "Protein", value: recipe.protein, suffix: "g" },
    { label: "Carbs", value: recipe.carbs, suffix: "g" },
    { label: "Fett", value: recipe.fats, suffix: "g" },
  ].filter((item) => item.value !== null);

  const servingSize = formatNumber(recipe.serving_size);

  return (
    <div className="space-y-4">
      {recipe.image_url && (
        <div className="overflow-hidden rounded-xl border border-brand-card-border bg-brand-chip-neutral">
          <Image
            src={recipe.image_url}
            alt={recipe.name}
            width={720}
            height={480}
            className="h-56 w-full object-cover"
            unoptimized
          />
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-brand-ink">
              {recipe.name}
            </h3>
          </div>

          {recipe.source_url && (
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-brand-tertiary transition-colors hover:bg-brand-chip-neutral hover:text-brand-ink"
              aria-label={`Quelle für ${recipe.name} öffnen`}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-brand-secondary">
          {recipe.prep_time && (
            <span className="rounded-full bg-brand-chip-neutral px-2.5 py-1">
              {recipe.prep_time}
            </span>
          )}
          {servingSize && (
            <span className="rounded-full bg-brand-chip-neutral px-2.5 py-1">
              {servingSize} Portionen
            </span>
          )}
        </div>

        <TagBadges tags={tags} />
      </div>

      {nutritionItems.length > 0 && (
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-brand-stat-bg p-3">
          {nutritionItems.map((item) => (
            <div
              key={item.label}
              className="rounded-md bg-white px-3 py-2 ring-1 ring-brand-card-border"
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-brand-muted">
                {item.label}
              </p>
              <p className="mt-1 text-sm font-semibold text-brand-ink">
                {formatNumber(item.value)}
                {item.suffix}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
            Zutaten
          </h4>
          {ingredientLines.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm text-brand-secondary">
              {ingredientLines.map((ingredient) => (
                <li key={ingredient} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-muted" />
                  <span>{ingredient}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-brand-tertiary">
              Keine Zutaten
            </p>
          )}
        </div>

        {preparationLines.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
              Zubereitung
            </h4>
            <ol className="mt-2 space-y-2 text-sm text-brand-secondary">
              {preparationLines.map((step, index) => (
                <li key={`${index}-${step}`} className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-chip-neutral text-xs font-medium text-brand-secondary">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

interface RecipeListProps {
  recipes: Recipe[];
  recipeTagsById: Record<string, string[]>;
  loading: boolean;
  onRecipeEdit?: (recipe: Recipe) => void;
  onRecipeDelete?: (recipe: Recipe) => void;
  onRecipeSelect?: (recipe: Recipe) => void;
  showActions?: boolean;
  disableDrag?: boolean;
  selectedRecipeId?: string | null;
  toolbarActions?: React.ReactNode;
}

export function RecipeList({
  recipes,
  recipeTagsById,
  loading,
  onRecipeEdit,
  onRecipeDelete,
  onRecipeSelect,
  showActions = true,
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
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Suchen…"
          aria-label="Rezepte suchen"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setShowFilters((prev) => !prev)}
          aria-label="Filter umschalten"
          aria-expanded={showFilters}
          className={cn(
            "shrink-0",
            hasActiveFilters &&
              "border-brand-accent-dark text-brand-accent-dark",
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
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
        <p className="text-sm text-brand-tertiary">Lädt…</p>
      ) : recipes.length === 0 ? (
        <p className="text-sm text-brand-tertiary">Noch keine Rezepte</p>
      ) : filteredRecipes.length === 0 ? (
        <p className="text-sm text-brand-tertiary">
          Keine Treffer
        </p>
      ) : (
        filteredRecipes.map((recipe) => {
          const recipeTags = recipeTagsById[recipe.id] ?? [];
          const primaryNutritionItems = getPrimaryNutritionItems(recipe);

          const rowContent = (
            <>
              <div className="min-w-0 flex-1">
                <h3
                  className="truncate text-sm font-bold text-brand-ink"
                  title={recipe.name}
                >
                  {truncateTitle(recipe.name)}
                </h3>

                {primaryNutritionItems.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {primaryNutritionItems.map((item) => (
                      <div
                        key={item.label}
                        className={`inline-flex items-center gap-1 rounded-md py-0.5 text-xs font-bold ${item.textClassName}`}
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

                {recipeTags.length > 0 && (
                  <div className="mt-2">
                    <TagBadges tags={recipeTags} />
                  </div>
                )}
              </div>
            </>
          );

          const openPreview = () =>
            openScreen({ kind: "recipe-preview", recipe, tags: recipeTags });

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
              onClick={() => {
                if (!showActions) {
                  onRecipeSelect?.(recipe);
                }
              }}
              className={`group rounded-lg border p-3 transition-colors hover:bg-brand-app-bg ${
                selectedRecipeId === recipe.id
                  ? "border-blue-300 bg-blue-50/40"
                  : "border-brand-card-border"
              } ${disableDrag ? "cursor-pointer" : "cursor-move"}`}
            >
              <div className="flex items-start justify-between gap-2">
                {showActions ? (
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    aria-label={`${recipe.name} als Vorschau anzeigen`}
                    onClick={() => {
                      onRecipeSelect?.(recipe);
                      openPreview();
                    }}
                  >
                    {rowContent}
                  </button>
                ) : (
                  <div className="flex flex-1 items-start gap-3">
                    {rowContent}
                  </div>
                )}
                {showActions && (
                  <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onRecipeEdit?.(recipe)}
                      aria-label={`${recipe.name} bearbeiten`}
                    >
                      <Pencil className="h-4 w-4 text-brand-tertiary" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onRecipeDelete?.(recipe)}
                      aria-label={`${recipe.name} löschen`}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                )}
                {!showActions && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Details für ${recipe.name} anzeigen`}
                    onClick={(e) => {
                      e.stopPropagation();
                      openPreview();
                    }}
                  >
                    <Info className="h-4 w-4 text-brand-muted" />
                  </Button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
