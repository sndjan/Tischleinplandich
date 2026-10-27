"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRecipesQuery } from "@/hooks/use-planner-data";
import { cn } from "@/lib/utils";
import { RecipeList } from "./recipe-list";
import { DiscoverRecipes } from "./discover-recipes";
import { useScreenStack } from "./screen-stack";

type LibraryTab = "mine" | "discover";

export function RecipeLibrary() {
  const { openScreen } = useScreenStack();
  const { data, isPending } = useRecipesQuery();
  const [tab, setTab] = useState<LibraryTab>("mine");
  const count = data?.recipes.length;

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Rezepte" className="grid h-10 grid-cols-2 rounded-xl bg-brand-chip-neutral p-[3px] text-sm font-bold">
        {(
          [
            ["mine", count !== undefined ? `Meine · ${count}` : "Meine"],
            ["discover", "Entdecken"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "rounded-[10px] transition-all active:scale-[0.97]",
              tab === value ? "bg-white text-brand-ink shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "text-brand-secondary",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "mine" ? (
        <RecipeList
          recipes={data?.recipes ?? []}
          recipeTagsById={data?.tagsById ?? {}}
          loading={isPending}
          toolbarActions={
            <Button
              type="button"
              onClick={() => openScreen({ kind: "recipe-create" })}
              className="h-11 shrink-0 gap-1 rounded-xl px-3.5 text-sm font-bold"
            >
              <Plus className="size-4" strokeWidth={2.5} />
              Neu
            </Button>
          }
        />
      ) : (
        <DiscoverRecipes />
      )}
    </div>
  );
}
