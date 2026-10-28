"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useRecipesQuery } from "@/hooks/use-planner-data";
import { RecipeList } from "./recipe-list";
import { DiscoverRecipes } from "./discover-recipes";
import { SegmentedTabs } from "./segmented-tabs";
import { useShowNutrition } from "./nutrition-target-settings";
import { useScreenStack } from "./screen-stack";

export type LibraryTab = "mine" | "discover";

/**
 * Own recipes and "Entdecken". With `tab` set, the parent shows the tabs
 * itself (the desktop panel merges them with "Einkaufsliste").
 */
export function RecipeLibrary({ tab: controlledTab }: { tab?: LibraryTab } = {}) {
  const { openScreen } = useScreenStack();
  const { data, isPending } = useRecipesQuery();
  const showNutrition = useShowNutrition();
  const [ownTab, setTab] = useState<LibraryTab>("mine");
  const tab = controlledTab ?? ownTab;
  const count = data?.recipes.length;

  return (
    <div className="space-y-3">
      {!controlledTab && (
        <SegmentedTabs
          label="Rezepte"
          value={tab}
          onChange={setTab}
          options={[
            { value: "mine", label: count !== undefined ? `Meine · ${count}` : "Meine" },
            { value: "discover", label: "Entdecken" },
          ]}
        />
      )}

      {tab === "mine" ? (
        <RecipeList
          recipes={data?.recipes ?? []}
          recipeTagsById={data?.tagsById ?? {}}
          loading={isPending}
          showNutrition={showNutrition}
          toolbarActions={
            <button
              type="button"
              onClick={() => openScreen({ kind: "recipe-create" })}
              className="flex h-11 shrink-0 touch-manipulation items-center gap-1 rounded-xl bg-brand-accent px-3.5 text-sm font-bold text-white transition-transform active:bg-brand-accent-dark active:scale-[0.97]"
            >
              <Plus className="size-4" strokeWidth={2.5} />
              Neu
            </button>
          }
        />
      ) : (
        <DiscoverRecipes />
      )}
    </div>
  );
}
