"use client";

import { useEffect, useState } from "react";
import { createClient, getSessionUser } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import type { Recipe, MealType } from "@/types/database";
import { MEAL_TYPE_LABELS } from "@/lib/meal-labels";
import toast from "react-hot-toast";
import { RecipeList } from "./recipe-list";

interface AddMealDialogProps {
  dayOfWeek: number;
  mealType: MealType;
  onMealAdded: () => void;
  label?: string;
}

const WEEK_DAYS: Record<number, string> = {
  0: "Montag",
  1: "Dienstag",
  2: "Mittwoch",
  3: "Donnerstag",
  4: "Freitag",
  5: "Samstag",
  6: "Sonntag",
};

export function AddMealDialog({
  dayOfWeek,
  mealType,
  onMealAdded,
  label = MEAL_TYPE_LABELS[mealType],
}: AddMealDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeTagsById, setRecipeTagsById] = useState<
    Record<string, string[]>
  >({});
  const [selectedRecipe, setSelectedRecipe] = useState<string>("");
  const [servingSize, setServingSize] = useState("1");
  const [loading, setLoading] = useState(false);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (isOpen) {
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
          toast.error("Rezepte konnten nicht geladen werden");
        } finally {
          setLoadingRecipes(false);
        }
      };

      fetchRecipes();
    }
  }, [isOpen, supabase]);

  const handleAddMeal = async () => {
    if (!selectedRecipe) {
      toast.error("Bitte wähle ein Rezept aus");
      return;
    }

    setLoading(true);

    try {
      const user = await getSessionUser();

      if (!user) {
        toast.error("Du musst angemeldet sein");
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
        toast.error("Essensplan konnte nicht erstellt werden");
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

      toast.success("Mahlzeit erfolgreich hinzugefügt!");
      setIsOpen(false);
      setSelectedRecipe("");
      setServingSize("1");
      onMealAdded();
    } catch (err) {
      toast.error("Mahlzeit konnte nicht hinzugefügt werden");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-xl border border-dashed border-brand-disabled px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-brand-muted transition-colors hover:border-brand-secondary hover:text-brand-secondary"
        >
          {label}
          <Plus className="h-4 w-4 text-brand-icon-muted" />
        </button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-2xl"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {MEAL_TYPE_LABELS[mealType]} hinzufügen für {WEEK_DAYS[dayOfWeek] ?? dayOfWeek}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="max-h-[50vh] overflow-y-auto pr-1">
            <RecipeList
              recipes={recipes}
              recipeTagsById={recipeTagsById}
              loading={loadingRecipes}
              onRecipeSelect={(recipe) => setSelectedRecipe(recipe.id)}
              onRecipeEdit={() => {}}
              onRecipeDelete={() => {}}
              showActions={false}
              disableDrag
              selectedRecipeId={selectedRecipe || null}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="serving-size">Portionsgröße</Label>
            <Input
              id="serving-size"
              type="number"
              step="0.5"
              min="0.5"
              value={servingSize}
              onChange={(e) => setServingSize(e.target.value)}
            />
          </div>

          <Button
            onClick={handleAddMeal}
            disabled={loading || !selectedRecipe}
            className="w-full"
          >
            {loading ? "Wird hinzugefügt..." : "Ausgewähltes Rezept hinzufügen"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
