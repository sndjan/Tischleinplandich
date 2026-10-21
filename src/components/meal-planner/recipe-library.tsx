"use client";

import { useEffect, useRef, useState } from "react";
import { createClient, getSessionUser } from "@/lib/supabase/client";
import {
  getRecipeImagePathFromUrl,
  RECIPE_IMAGE_BUCKET,
} from "../../lib/recipe-images";
import { Button } from "@/components/ui/button";
import type { Recipe } from "@/types/database";
import { Download, Plus, Upload } from "lucide-react";
import toast from "react-hot-toast";
import { RecipeList } from "./recipe-list";

interface RecipeLibraryProps {
  onNewRecipe: () => void;
  onRecipeSelect: (recipe: Recipe) => void;
  onRecipeEdit: (recipe: Recipe) => void;
}

type ImportedRecipe = {
  name: string;
  ingredients: string;
  preparation_steps: string | null;
  source_url: string | null;
  prep_time: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  serving_size: number;
  is_public: boolean;
  tags: string[];
};

const parseNumberValue = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const normalizeLineField = (value: unknown): string | null => {
  if (Array.isArray(value)) {
    const lines = value
      .map((line) => (typeof line === "string" ? line.trim() : ""))
      .filter(Boolean);

    return lines.length > 0 ? lines.join("\n") : null;
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  return null;
};

const normalizeTagList = (value: unknown): string[] => {
  const seen = new Set<string>();

  if (Array.isArray(value)) {
    return value
      .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
      .filter(Boolean)
      .filter((tag) => {
        const normalizedTag = tag.toLowerCase();

        if (seen.has(normalizedTag)) {
          return false;
        }

        seen.add(normalizedTag);
        return true;
      });
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .filter((tag) => {
        const normalizedTag = tag.toLowerCase();

        if (seen.has(normalizedTag)) {
          return false;
        }

        seen.add(normalizedTag);
        return true;
      });
  }

  return [];
};

const normalizeImportedRecipe = (
  rawRecipe: unknown,
  index: number,
): { recipe: ImportedRecipe | null; error: string | null } => {
  if (!rawRecipe || typeof rawRecipe !== "object") {
    return {
      recipe: null,
      error: `Rezept #${index + 1} ist kein gültiges Objekt`,
    };
  }

  const recipeRecord = rawRecipe as Record<string, unknown>;
  const name =
    typeof recipeRecord.name === "string" ? recipeRecord.name.trim() : "";

  const ingredients = normalizeLineField(recipeRecord.ingredients);

  if (!name) {
    return {
      recipe: null,
      error: `Rezept #${index + 1} hat keinen gültigen Namen`,
    };
  }

  if (!ingredients) {
    return {
      recipe: null,
      error: `Rezept #${index + 1} hat keine Zutaten`,
    };
  }

  const preparationSteps = normalizeLineField(
    recipeRecord.preparation_steps ?? recipeRecord.preparationSteps,
  );

  const sourceUrlRaw = recipeRecord.source_url ?? recipeRecord.sourceUrl;
  const prepTimeRaw = recipeRecord.prep_time ?? recipeRecord.prepTime;
  const isPublicRaw = recipeRecord.is_public ?? recipeRecord.isPublic;
  const servingSizeRaw =
    recipeRecord.serving_size ?? recipeRecord.servingSize ?? 1;

  const sourceUrl =
    typeof sourceUrlRaw === "string" && sourceUrlRaw.trim().length > 0
      ? sourceUrlRaw.trim()
      : null;

  const prepTime =
    typeof prepTimeRaw === "string" && prepTimeRaw.trim().length > 0
      ? prepTimeRaw.trim()
      : null;

  return {
    recipe: {
      name,
      ingredients,
      preparation_steps: preparationSteps,
      source_url: sourceUrl,
      prep_time: prepTime,
      calories: parseNumberValue(recipeRecord.calories),
      protein: parseNumberValue(recipeRecord.protein),
      carbs: parseNumberValue(recipeRecord.carbs),
      fats: parseNumberValue(recipeRecord.fats),
      serving_size: parseNumberValue(servingSizeRaw) ?? 1,
      is_public: Boolean(isPublicRaw),
      tags: normalizeTagList(recipeRecord.tags),
    },
    error: null,
  };
};

const RECIPE_IMPORT_TEMPLATE = {
  recipes: [
    {
      name: "Sheet Pan Chicken and Veggies",
      ingredients: [
        "2 chicken breasts",
        "2 cups broccoli florets",
        "1 bell pepper",
        "2 tbsp olive oil",
        "Salt and pepper to taste",
      ],
      preparation_steps: [
        "Preheat oven to 425F",
        "Toss chopped vegetables with olive oil and seasoning",
        "Add chicken and bake for 20-25 minutes",
      ],
      tags: ["high protein", "dinner", "meal prep"],
      prep_time: "30 min",
      source_url: "https://example.com/sheet-pan-chicken",
      calories: 520,
      protein: 46,
      carbs: 22,
      fats: 24,
      serving_size: 2,
      is_public: false,
    },
    {
      name: "Greek Yogurt Berry Bowl",
      ingredients:
        "1 cup greek yogurt\n1/2 cup mixed berries\n1 tbsp chia seeds",
      preparation_steps: "Combine all ingredients in a bowl and serve chilled",
      tags: "breakfast, quick",
      prep_time: "5 min",
      calories: 260,
      protein: 20,
      carbs: 25,
      fats: 8,
      serving_size: 1,
      is_public: false,
    },
  ],
};

export function RecipeLibrary({
  onNewRecipe,
  onRecipeSelect,
  onRecipeEdit,
}: RecipeLibraryProps) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeTagsById, setRecipeTagsById] = useState<
    Record<string, string[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
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
      toast.error("Rezepte konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, []);

  const handleImportButtonClick = () => {
    if (isImporting) {
      return;
    }

    importFileInputRef.current?.click();
  };

  const handleDownloadTemplate = () => {
    const templateJson = JSON.stringify(RECIPE_IMPORT_TEMPLATE, null, 2);
    const fileBlob = new Blob([templateJson], { type: "application/json" });
    const fileUrl = URL.createObjectURL(fileBlob);

    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = "recipe-import-template.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(fileUrl);

    toast.success("Vorlage heruntergeladen");
  };

  const handleJsonImport = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const jsonFile = event.target.files?.[0];
    event.target.value = "";

    if (!jsonFile) {
      return;
    }

    if (!jsonFile.name.toLowerCase().endsWith(".json")) {
      toast.error("Bitte wähle eine JSON-Datei aus");
      return;
    }

    setIsImporting(true);

    try {
      const user = await getSessionUser();

      if (!user) {
        toast.error("Du musst angemeldet sein, um Rezepte zu importieren");
        return;
      }

      const rawJson = await jsonFile.text();
      const parsedJson = JSON.parse(rawJson) as unknown;

      const rawRecipes = Array.isArray(parsedJson)
        ? parsedJson
        : parsedJson &&
            typeof parsedJson === "object" &&
            Array.isArray((parsedJson as Record<string, unknown>).recipes)
          ? ((parsedJson as Record<string, unknown>).recipes as unknown[])
          : null;

      if (!rawRecipes || rawRecipes.length === 0) {
        toast.error(
          "Ungültige Importdatei. Verwende ein Array von Rezepten oder ein Objekt mit einem recipes-Array.",
        );
        return;
      }

      const normalizedRecipes: ImportedRecipe[] = [];
      const validationErrors: string[] = [];

      rawRecipes.forEach((rawRecipe, index) => {
        const { recipe, error } = normalizeImportedRecipe(rawRecipe, index);

        if (!recipe && error) {
          validationErrors.push(error);
          return;
        }

        if (recipe) {
          normalizedRecipes.push(recipe);
        }
      });

      if (normalizedRecipes.length === 0) {
        toast.error(validationErrors[0] || "Keine gültigen Rezepte in der JSON-Datei gefunden");
        return;
      }

      const { data: existingTags, error: existingTagsError } = await supabase
        .from("tags")
        .select("id, name")
        .eq("user_id", user.id);

      if (existingTagsError) {
        throw existingTagsError;
      }

      const existingTagMap = new Map<string, { id: string; name: string }>();

      (existingTags ?? []).forEach((tag: any) => {
        const tagId = tag.id as string;
        const tagName = tag.name as string;

        if (!tagId || !tagName) {
          return;
        }

        existingTagMap.set(tagName.toLowerCase(), { id: tagId, name: tagName });
      });

      let importedCount = 0;
      let failedCount = 0;

      for (const recipe of normalizedRecipes) {
        try {
          const { data: insertedRecipe, error: insertRecipeError } =
            await supabase
              .from("recipes")
              .insert({
                user_id: user.id,
                name: recipe.name,
                ingredients: recipe.ingredients,
                preparation_steps: recipe.preparation_steps,
                source_url: recipe.source_url,
                prep_time: recipe.prep_time,
                calories: recipe.calories,
                protein: recipe.protein,
                carbs: recipe.carbs,
                fats: recipe.fats,
                serving_size: recipe.serving_size,
                image_url: null,
                is_public: recipe.is_public,
              } as never)
              .select("id")
              .single();

          if (insertRecipeError) {
            throw insertRecipeError;
          }

          const recipeId = (insertedRecipe as { id: string } | null)?.id;

          if (!recipeId) {
            throw new Error("Recipe insert did not return an ID");
          }

          if (recipe.tags.length > 0) {
            const tagIds: string[] = [];

            for (const tagName of recipe.tags) {
              const normalizedTagName = tagName.toLowerCase();
              const existingTag = existingTagMap.get(normalizedTagName);

              if (existingTag) {
                tagIds.push(existingTag.id);
                continue;
              }

              const { data: insertedTag, error: insertTagError } =
                await supabase
                  .from("tags")
                  .insert({
                    user_id: user.id,
                    name: tagName,
                  } as never)
                  .select("id, name")
                  .single();

              if (insertTagError) {
                throw insertTagError;
              }

              const newTagId = (insertedTag as { id: string } | null)?.id;

              if (!newTagId) {
                continue;
              }

              existingTagMap.set(normalizedTagName, {
                id: newTagId,
                name: tagName,
              });
              tagIds.push(newTagId);
            }

            if (tagIds.length > 0) {
              const { error: recipeTagsError } = await supabase
                .from("recipe_tags")
                .insert(
                  tagIds.map((tagId) => ({
                    recipe_id: recipeId,
                    tag_id: tagId,
                  })) as never,
                );

              if (recipeTagsError) {
                throw recipeTagsError;
              }
            }
          }

          importedCount += 1;
        } catch {
          failedCount += 1;
        }
      }

      await fetchRecipes();

      if (importedCount > 0) {
        toast.success(
          `${importedCount} Rezept${importedCount === 1 ? "" : "e"} importiert`,
        );
      }

      if (failedCount > 0) {
        toast.error(
          `${failedCount} Rezept${failedCount === 1 ? "" : "e"} konnte${failedCount === 1 ? "" : "n"} nicht importiert werden`,
        );
      }

      if (validationErrors.length > 0) {
        toast.error(validationErrors[0]);
      }
    } catch (error) {
      toast.error("Rezepte konnten nicht aus JSON importiert werden");
    } finally {
      setIsImporting(false);
    }
  };

  const handleDelete = async (recipe: Recipe) => {
    try {
      const { error } = await supabase
        .from("recipes")
        .delete()
        .eq("id", recipe.id);

      if (error) throw error;

      const imagePath = getRecipeImagePathFromUrl(recipe.image_url);

      if (imagePath) {
        await supabase.storage.from(RECIPE_IMAGE_BUCKET).remove([imagePath]);
      }

      setRecipes((currentRecipes) =>
        currentRecipes.filter((r) => r.id !== recipe.id),
      );
      setRecipeTagsById((currentTagsById) => {
        const nextTagsById = { ...currentTagsById };
        delete nextTagsById[recipe.id];
        return nextTagsById;
      });

      toast.success("Rezept gelöscht");
    } catch (err) {
      toast.error("Rezept konnte nicht gelöscht werden");
    }
  };

  const toolbarActions = (
    <>
      <input
        ref={importFileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleJsonImport}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleDownloadTemplate}
        aria-label="Rezept-Importvorlage herunterladen"
        title="Rezept-Importvorlage herunterladen"
      >
        <Download className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleImportButtonClick}
        disabled={isImporting}
        aria-label="Rezepte aus JSON importieren"
        title="Rezepte aus JSON importieren"
      >
        <Upload className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onNewRecipe}
        aria-label="Neues Rezept hinzufügen"
        title="Neues Rezept hinzufügen"
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
      onRecipeEdit={onRecipeEdit}
      onRecipeDelete={handleDelete}
      onRecipeSelect={onRecipeSelect}
      toolbarActions={toolbarActions}
    />
  );
}
