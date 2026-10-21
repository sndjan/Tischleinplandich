"use client";

import { useEffect, useState } from "react";
import { createClient, getSessionUser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import type { Recipe, MealType } from "@/types/database";
import { MEAL_TYPE_LABELS } from "@/lib/meal-labels";
import toast from "react-hot-toast";
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
      className="flex w-full items-center justify-between rounded-xl border border-dashed border-brand-disabled px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-brand-muted transition-colors hover:border-brand-secondary hover:text-brand-secondary"
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
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeTagsById, setRecipeTagsById] = useState<
    Record<string, string[]>
  >({});
  const [selectedRecipe, setSelectedRecipe] = useState<string>("");
  const [servingSize, setServingSize] = useState("1");
  const [loading, setLoading] = useState(false);
  const [loadingRecipes, setLoadingRecipes] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        setLoadingRecipes(true);

        const user = await getSessionUser();

        if (!user) return;

        const { data } = await supabase
          .from("recipes")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (data) setRecipes(data);

        const recipeIds = (data ?? []).map((recipe) => recipe.id);
        if (recipeIds.length === 0) {
          setRecipeTagsById({});
          return;
        }

        const { data: recipeTagsData, error: recipeTagsError } =
          await supabase
            .from("recipe_tags")
            .select("recipe_id, tags(name)")
            .in("recipe_id", recipeIds);

        if (recipeTagsError) throw recipeTagsError;

        const nextRecipeTagsById: Record<string, string[]> = {};

        (recipeTagsData ?? []).forEach((entry: any) => {
          const recipeId = entry.recipe_id as string;
          const tagName = Array.isArray(entry.tags)
            ? (entry.tags[0]?.name as string | undefined)
            : (entry.tags?.name as string | undefined);

          if (!recipeId || !tagName) {
            return;
          }

          if (!nextRecipeTagsById[recipeId]) {
            nextRecipeTagsById[recipeId] = [];
          }

          const alreadyExists = nextRecipeTagsById[recipeId].some(
            (existingTag) =>
              existingTag.toLowerCase() === tagName.toLowerCase(),
          );

          if (!alreadyExists) {
            nextRecipeTagsById[recipeId].push(tagName);
          }
        });

        Object.values(nextRecipeTagsById).forEach((tags) => {
          tags.sort((a, b) => a.localeCompare(b));
        });

        setRecipeTagsById(nextRecipeTagsById);
      } catch (err) {
        toast.error("Laden fehlgeschlagen");
      } finally {
        setLoadingRecipes(false);
      }
    };

    fetchRecipes();
  }, [supabase]);

  const handleAddMeal = async () => {
    if (!selectedRecipe) {
      toast.error("Wähle ein Rezept");
      return;
    }

    setLoading(true);

    try {
      const user = await getSessionUser();

      if (!user) {
        toast.error("Nicht angemeldet");
        return;
      }

      // Get or create meal plan for this week
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const dateStr = weekStart.toISOString().split("T")[0];

      const { data: mealPlanData } = await supabase
        .from("meal_plans")
        .select("*")
        .eq("user_id", user.id)
        .eq("week_start_date", dateStr)
        .maybeSingle();

      // @ts-ignore - TypeScript server not inferring Database types correctly
      let mealPlanId: string | undefined = mealPlanData?.id;

      if (!mealPlanId) {
        // @ts-ignore - TypeScript server not inferring Database types correctly
        const { data: newMealPlan, error: createError } = await supabase
          .from("meal_plans")
          // @ts-ignore - TypeScript server not inferring Database types correctly
          .insert({
            user_id: user.id,
            week_start_date: dateStr,
          })
          .select("*")
          .single();

        if (createError) throw createError;
        // @ts-ignore - TypeScript server not inferring Database types correctly
        mealPlanId = newMealPlan?.id;
      }

      if (!mealPlanId) {
        toast.error("Plan konnte nicht erstellt werden");
        return;
      }

      // Add the meal
      // @ts-ignore - TypeScript server not inferring Database types correctly
      const { error: insertError } = await supabase
        .from("planned_meals")
        // @ts-ignore - TypeScript server not inferring Database types correctly
        .insert({
          meal_plan_id: mealPlanId,
          recipe_id: selectedRecipe,
          day_of_week: dayOfWeek,
          meal_type: mealType,
          serving_size: parseFloat(servingSize) || 1,
        });

      if (insertError) throw insertError;

      toast.success("Hinzugefügt");
      onMealAdded();
    } catch (err) {
      toast.error("Hinzufügen fehlgeschlagen");
      console.error(err);
    } finally {
      setLoading(false);
    }
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
            disabled={loading || !selectedRecipe}
            className="flex-1"
          >
            {loading ? "Fügt hinzu…" : "Hinzufügen"}
          </Button>
        </div>
      }
    >
      <RecipeList
        recipes={recipes}
        recipeTagsById={recipeTagsById}
        loading={loadingRecipes}
        onRecipeSelect={(recipe) => setSelectedRecipe(recipe.id)}
        showActions={false}
        disableDrag
        selectedRecipeId={selectedRecipe || null}
      />
    </SubPage>
  );
}
