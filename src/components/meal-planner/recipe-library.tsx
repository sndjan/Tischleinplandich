"use client";

import { useEffect, useState } from "react";
import { createClient, getSessionUser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { Recipe } from "@/types/database";
import { Plus, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { RecipeList } from "./recipe-list";
import { useScreenStack } from "./screen-stack";

export function RecipeLibrary() {
  const { openScreen } = useScreenStack();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeTagsById, setRecipeTagsById] = useState<
    Record<string, string[]>
  >({});
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchRecipes = async () => {
    try {
      const user = await getSessionUser();

      if (!user) return;

      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const fetchedRecipes = (data ?? []) as Recipe[];
      setRecipes(fetchedRecipes);

      if (fetchedRecipes.length === 0) {
        setRecipeTagsById({});
        return;
      }

      const { data: recipeTags, error: recipeTagsError } = await supabase
        .from("recipe_tags")
        .select("recipe_id, tags(name)")
        .in(
          "recipe_id",
          fetchedRecipes.map((recipe) => recipe.id),
        );

      if (recipeTagsError) throw recipeTagsError;

      const nextRecipeTagsById: Record<string, string[]> = {};

      (recipeTags ?? []).forEach((entry: any) => {
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

        const tagAlreadyExists = nextRecipeTagsById[recipeId].some(
          (existingTag) => existingTag.toLowerCase() === tagName.toLowerCase(),
        );

        if (!tagAlreadyExists) {
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
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, []);

  const toolbarActions = (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => openScreen({ kind: "recipe-ai-import" })}
        aria-label="KI-Import"
        title="KI-Import"
      >
        <Sparkles className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={() => openScreen({ kind: "recipe-form" })}
        aria-label="Neues Rezept"
        title="Neues Rezept"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </>
  );

  return (
    <RecipeList
      recipes={recipes}
      recipeTagsById={recipeTagsById}
      loading={loading}
      toolbarActions={toolbarActions}
    />
  );
}
