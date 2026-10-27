"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, Plus, Search, UtensilsCrossed } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "@/hooks/use-planner-data";
import { findOwnCopy, readSavedSharedIds, useSaveSharedRecipe, type SharedRecipe } from "@/lib/recipe-sharing";
import type { Recipe } from "@/types/database";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useScreenStack } from "./screen-stack";

const formatNumber = (value: number) => Math.round(value).toLocaleString("de-DE");

class MissingMigrationError extends Error {}

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Remembers which shared recipes were saved, so their button shows a check.
 */
export function useSavedSharedRecipes() {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const saveSharedRecipe = useSaveSharedRecipe();
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => setSavedIds(new Set(readSavedSharedIds())), []);

  const save = async (recipe: SharedRecipe) => {
    if (savedIds.has(recipe.id) || savingId) return;
    setSavingId(recipe.id);
    try {
      await saveSharedRecipe(recipe);
      setSavedIds((prev) => new Set(prev).add(recipe.id));
      if (navigator.vibrate) navigator.vibrate(10);
      toast.success("In deinen Rezepten gespeichert");
    } catch (error) {
      console.error(error);
      toast.error("Speichern fehlgeschlagen");
    } finally {
      setSavingId(null);
    }
  };

  /**
   * The user's own copy to plan with, saving one first if there is none yet.
   * Resolves null when saving failed (the error is already shown).
   */
  const ensureCopy = async (recipe: SharedRecipe, ownRecipes: Recipe[]): Promise<Recipe | null> => {
    const existing = findOwnCopy(recipe, ownRecipes);
    if (existing) return existing;
    if (savingId) return null;

    setSavingId(recipe.id);
    try {
      const copy = await saveSharedRecipe(recipe);
      setSavedIds((prev) => new Set(prev).add(recipe.id));
      return copy;
    } catch (error) {
      console.error(error);
      toast.error("Speichern fehlgeschlagen");
      return null;
    } finally {
      setSavingId(null);
    }
  };

  return { savedIds, savingId, save, ensureCopy };
}

export function DiscoverRecipes() {
  const { openScreen } = useScreenStack();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search.trim(), 300);
  const { savedIds, savingId, save } = useSavedSharedRecipes();

  const { data, isPending, error } = useQuery({
    queryKey: queryKeys.discover(debouncedSearch),
    staleTime: 60_000,
    retry: (count, queryError) => !(queryError instanceof MissingMigrationError) && count < 2,
    queryFn: async () => {
      const { data: rows, error: rpcError } = await createClient().rpc("discover_recipes", {
        p_search: debouncedSearch || null,
        p_limit: 60,
      });
      // The function does not exist until migration 011 has run.
      if (rpcError?.code === "PGRST202" || rpcError?.code === "42883") throw new MissingMigrationError();
      if (rpcError) throw rpcError;
      return (rows ?? []) as unknown as SharedRecipe[];
    },
  });

  return (
    <div className="space-y-3">
      <label className="flex h-11 items-center gap-2 rounded-xl bg-brand-chip-neutral px-3">
        <Search className="size-4 text-brand-secondary" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="In Rezepten von anderen suchen"
          aria-label="In Rezepten von anderen suchen"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-brand-ink outline-none placeholder:text-brand-muted"
        />
      </label>

      {error instanceof MissingMigrationError ? (
        <p className="rounded-2xl bg-[#fdf0d5] p-4 text-sm leading-relaxed text-[#7a4f0e]">
          „Entdecken“ braucht noch ein kleines Datenbank-Update (supabase/migrations/011_recipe_sharing.sql).
        </p>
      ) : error ? (
        <p className="py-8 text-center text-sm text-brand-secondary">Konnte nicht geladen werden</p>
      ) : isPending ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2" aria-busy="true" aria-label="Lädt">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-[196px] rounded-2xl" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-3xl" aria-hidden="true">🌍</p>
          <p className="mt-2 font-heading text-lg font-extrabold text-brand-ink">
            {debouncedSearch ? "Nichts gefunden" : "Noch nichts zu entdecken"}
          </p>
          {!debouncedSearch && (
            <p className="mt-1 text-sm text-brand-secondary">
              Wenn jemand ein Rezept unter „Teilen“ für Entdecken freigibt, erscheint es hier.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2">
          {data.map((recipe) => {
            const saved = savedIds.has(recipe.id);
            return (
              <article key={recipe.id} className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-brand-card-border">
                <button
                  type="button"
                  onClick={() => openScreen({ kind: "shared-recipe", recipe })}
                  className="block w-full text-left transition-transform active:scale-[0.98]"
                >
                  <div className="aspect-[4/3] bg-brand-chip-neutral">
                    {recipe.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={recipe.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <UtensilsCrossed className="size-8 text-brand-muted" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-0.5 px-2.5 pb-3 pt-2">
                    <h3 className="line-clamp-2 text-sm font-bold leading-tight text-brand-ink">{recipe.name}</h3>
                    {recipe.calories != null && (
                      <p className="text-xs font-semibold text-brand-accent-dark">
                        {formatNumber(recipe.calories)} kcal
                        {recipe.protein != null && ` · ${formatNumber(recipe.protein)} g`}
                      </p>
                    )}
                    <p className="truncate text-xs text-brand-tertiary">von {recipe.author_name || "jemandem"}</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => void save(recipe)}
                  aria-label={saved ? `${recipe.name} gespeichert` : `${recipe.name} speichern`}
                  className={cn(
                    "absolute right-2 top-2 flex size-9 items-center justify-center rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-all active:scale-90",
                    saved ? "bg-brand-accent-dark text-white" : "bg-white text-brand-accent-dark",
                  )}
                >
                  {savingId === recipe.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : saved ? (
                    <Check className="size-4 animate-pop-in" strokeWidth={3} />
                  ) : (
                    <Plus className="size-4" strokeWidth={2.6} />
                  )}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
