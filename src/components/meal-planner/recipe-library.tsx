"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRecipesQuery } from "@/hooks/use-planner-data";
import { RecipeList } from "./recipe-list";
import { useScreenStack } from "./screen-stack";

export function RecipeLibrary() {
  const { openScreen } = useScreenStack();
  const { data, isPending } = useRecipesQuery();

  return (
    <RecipeList
      recipes={data?.recipes ?? []}
      recipeTagsById={data?.tagsById ?? {}}
      loading={isPending}
      toolbarActions={
        <Button
          type="button"
          onClick={() => openScreen({ kind: "recipe-create" })}
          className="h-8 shrink-0 gap-1 rounded-lg px-3 font-semibold"
        >
          <Plus className="size-4" strokeWidth={2.5} />
          Neu
        </Button>
      }
    />
  );
}
