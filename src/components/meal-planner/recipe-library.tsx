"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useRecipesQuery } from "@/hooks/use-planner-data";
import { cn } from "@/lib/utils";
import { RecipeList } from "./recipe-list";
import { DiscoverRecipes } from "./discover-recipes";
import { useScreenStack } from "./screen-stack";

export type LibraryTab = "mine" | "discover";

/**
 * Own recipes and "Entdecken". With `tab` set, the parent shows the tabs
 * itself (the desktop panel merges them with "Einkaufsliste").
 */
export function RecipeLibrary({ tab: controlledTab }: { tab?: LibraryTab } = {}) {
  const { openScreen } = useScreenStack();
  const { data, isPending } = useRecipesQuery();
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

/** Grey track with the selected tab as a white chip. */
export function SegmentedTabs<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="grid h-10 rounded-xl bg-brand-chip-neutral p-[3px] text-sm font-bold"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "truncate rounded-[10px] px-1 transition-all active:scale-[0.97]",
            value === option.value
              ? "bg-white text-brand-ink shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
              : "text-brand-secondary",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
