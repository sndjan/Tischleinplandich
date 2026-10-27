"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import type { MealType } from "@/types/database";
import { MEAL_TYPE_LABELS } from "@/lib/meal-labels";
import { useRecipesQuery } from "@/hooks/use-planner-data";
import { useAddMeal } from "@/hooks/use-planner-mutations";
import { RecipeList } from "./recipe-list";
import { SubPage } from "./sub-page";
import { useScreenStack } from "./screen-stack";

const WEEK_DAYS: Record<number, string> = {
  0: "Montag",
  1: "Dienstag",
  2: "Mittwoch",
  3: "Donnerstag",
  4: "Freitag",
  5: "Samstag",
  6: "Sonntag",
};

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
      className="flex w-full items-center justify-between rounded-xl border border-dashed border-brand-disabled px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-brand-muted transition-all duration-150 hover:border-brand-secondary hover:text-brand-secondary active:scale-[0.98] active:bg-brand-accent-bg active:text-brand-accent-dark"
    >
      {label}
      <Plus className="h-4 w-4 text-brand-icon-muted" />
    </button>
  );
}

interface AddMealScreenProps {
  dayOfWeek: number;
  mealType: MealType;
  onBack: () => void;
  onMealAdded: () => void;
}

export function AddMealScreen({
  dayOfWeek,
  mealType,
  onBack,
  onMealAdded,
}: AddMealScreenProps) {
  const { data, isPending } = useRecipesQuery();
  const addMeal = useAddMeal();
  const [selectedRecipe, setSelectedRecipe] = useState<string>("");
  const [servingSize, setServingSize] = useState("1");

  // The meal shows up in the plan right away; saving continues in the background.
  const handleAddMeal = () => {
    if (!selectedRecipe) return;

    addMeal({
      recipeId: selectedRecipe,
      dayIndex: dayOfWeek,
      mealType,
      servingSize: parseFloat(servingSize.replace(",", ".")) || 1,
    });
    onMealAdded();
  };

  return (
    <SubPage
      title={`${MEAL_TYPE_LABELS[mealType]} · ${WEEK_DAYS[dayOfWeek] ?? dayOfWeek}`}
      onBack={onBack}
      footer={
        <div className="flex items-end gap-3">
          <div className="w-24 shrink-0 space-y-1">
            <Label htmlFor="serving-size">Portionen</Label>
            <Input
              id="serving-size"
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0.5"
              value={servingSize}
              onChange={(e) => setServingSize(e.target.value)}
            />
          </div>
          <Button
            onClick={handleAddMeal}
            disabled={!selectedRecipe}
            className="h-10 flex-1 rounded-xl font-bold"
          >
            Hinzufügen
          </Button>
        </div>
      }
    >
      <RecipeList
        recipes={data?.recipes ?? []}
        recipeTagsById={data?.tagsById ?? {}}
        loading={isPending}
        onRecipeSelect={(recipe) => setSelectedRecipe(recipe.id)}
        selectionMode
        disableDrag
        selectedRecipeId={selectedRecipe || null}
      />
    </SubPage>
  );
}
