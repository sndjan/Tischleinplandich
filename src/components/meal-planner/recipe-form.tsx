'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient, getSessionUser } from '@/lib/supabase/client';
import { createRecipeImagePath, getRecipeImagePathFromUrl, RECIPE_IMAGE_BUCKET } from '../../lib/recipe-images';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Recipe } from '@/types/database';
import { Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  RecipeIngredientEditor,
  createEmptyIngredientRow,
  type IngredientRow,
} from './recipe-ingredient-editor';

interface RecipeFormProps {
  onRecipeSaved: () => void;
  recipe?: Recipe | null;
}

type RecipeFormData = {
  name: string;
  ingredients: string;
  preparation_steps: string;
  source_url: string;
  prep_time: string;
  tags: string;
  calories: string;
  protein: string;
  carbs: string;
  fats: string;
  serving_size: string;
  is_public: boolean;
};

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const parseTags = (tagsInput: string): string[] => {
  const seen = new Set<string>();

  return tagsInput
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .filter((tag) => {
      const normalized = tag.toLowerCase();
      if (seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    });
};

const rowsToLegacyIngredientsText = (rows: IngredientRow[]): string =>
  rows
    .filter((row) => row.foodItemId)
    .map((row) => {
      const parts = [row.quantity.trim(), row.unit.trim(), row.foodItemName].filter(
        (part) => part.length > 0,
      );
      return parts.join(' ');
    })
    .join('\n');

const getFormDataFromRecipe = (recipe?: Recipe | null): RecipeFormData => ({
  name: recipe?.name || '',
  ingredients: recipe?.ingredients || '',
  preparation_steps: recipe?.preparation_steps || '',
  source_url: recipe?.source_url || '',
  prep_time: recipe?.prep_time || '',
  tags: '',
  calories: recipe?.calories?.toString() || '',
  protein: recipe?.protein?.toString() || '',
  carbs: recipe?.carbs?.toString() || '',
  fats: recipe?.fats?.toString() || '',
  serving_size: recipe?.serving_size?.toString() || '1',
  is_public: recipe?.is_public || false,
});

export function RecipeForm({ onRecipeSaved, recipe }: RecipeFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(() => getFormDataFromRecipe(recipe));
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(recipe?.image_url || null);
  const [removeImage, setRemoveImage] = useState(false);
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>([
    createEmptyIngredientRow(),
  ]);
  const [recipeHadStructuredIngredientsOnLoad, setRecipeHadStructuredIngredientsOnLoad] =
    useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);

  const supabase = createClient();
  const isEditing = Boolean(recipe);
  const showLegacyIngredientsField = isEditing && !recipeHadStructuredIngredientsOnLoad;

  const clearPreviewObjectUrl = () => {
    if (!previewObjectUrlRef.current) {
      return;
    }

    URL.revokeObjectURL(previewObjectUrlRef.current);
    previewObjectUrlRef.current = null;
  };

  useEffect(() => {
    clearPreviewObjectUrl();
    setFormData(getFormDataFromRecipe(recipe));
    setSelectedImage(null);
    setImagePreviewUrl(recipe?.image_url || null);
    setRemoveImage(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [recipe]);

  useEffect(() => {
    return () => {
      clearPreviewObjectUrl();
    };
  }, []);

  useEffect(() => {
    const loadRecipeIngredients = async () => {
      if (!recipe) {
        setIngredientRows([createEmptyIngredientRow()]);
        setRecipeHadStructuredIngredientsOnLoad(false);
        return;
      }

      const { data, error } = await supabase
        .from('recipe_ingredients')
        .select('id, food_item_id, quantity, unit, display_order, food_items(name)')
        .eq('recipe_id', recipe.id)
        .order('display_order', { ascending: true });

      if (error) {
        toast.error('Rezeptzutaten konnten nicht geladen werden');
        return;
      }

      const loadedRows: IngredientRow[] = (data ?? []).map((entry: any) => ({
        rowId: entry.id as string,
        foodItemId: entry.food_item_id as string,
        foodItemName: Array.isArray(entry.food_items)
          ? ((entry.food_items[0]?.name as string | undefined) ?? '')
          : ((entry.food_items?.name as string | undefined) ?? ''),
        quantity: String(entry.quantity ?? 1),
        unit: (entry.unit as string | null) ?? '',
      }));

      setRecipeHadStructuredIngredientsOnLoad(loadedRows.length > 0);
      setIngredientRows(loadedRows.length > 0 ? loadedRows : [createEmptyIngredientRow()]);
    };

    loadRecipeIngredients();
  }, [recipe]);

  useEffect(() => {
    const loadRecipeTags = async () => {
      if (!recipe) {
        setFormData((prev) => ({ ...prev, tags: '' }));
        return;
      }

      const { data, error } = await supabase
        .from('recipe_tags')
        .select('tags(name)')
        .eq('recipe_id', recipe.id);

      if (error) {
        toast.error('Rezept-Tags konnten nicht geladen werden');
        return;
      }

      const tagNames = (data ?? [])
        .map((item: any) => {
          if (Array.isArray(item.tags)) {
            return item.tags[0]?.name;
          }

          return item.tags?.name;
        })
        .filter((name): name is string => Boolean(name));

      setFormData((prev) => ({ ...prev, tags: tagNames.join(', ') }));
    };

    loadRecipeTags();
  }, [recipe]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;

    if (!file) {
      clearPreviewObjectUrl();
      setSelectedImage(null);
      setImagePreviewUrl(recipe?.image_url || null);
      setRemoveImage(false);
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Bitte wähle eine gültige Bilddatei aus');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      toast.error('Das Bild darf höchstens 5 MB groß sein');
      e.target.value = '';
      return;
    }

    clearPreviewObjectUrl();

    const objectUrl = URL.createObjectURL(file);
    previewObjectUrlRef.current = objectUrl;

    setSelectedImage(file);
    setImagePreviewUrl(objectUrl);
    setRemoveImage(false);
  };

  const handleClearSelectedImage = () => {
    clearPreviewObjectUrl();
    setSelectedImage(null);
    setImagePreviewUrl(recipe?.image_url || null);
    setRemoveImage(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = () => {
    clearPreviewObjectUrl();
    setSelectedImage(null);
    setImagePreviewUrl(null);
    setRemoveImage(Boolean(recipe?.image_url));

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const syncRecipeTags = async (recipeId: string, userId: string, rawTags: string) => {
    const parsedTags = parseTags(rawTags);

    const { error: deleteError } = await supabase
      .from('recipe_tags')
      .delete()
      .eq('recipe_id', recipeId);

    if (deleteError) {
      throw deleteError;
    }

    if (parsedTags.length === 0) {
      return;
    }

    const { data: existingTags, error: existingTagsError } = await supabase
      .from('tags')
      .select('id, name')
      .eq('user_id', userId);

    if (existingTagsError) {
      throw existingTagsError;
    }

    const existingTagMap = new Map<string, string>(
      (existingTags ?? []).map((tag: any) => [tag.name.toLowerCase(), tag.id as string])
    );

    const tagIds: string[] = [];

    for (const tagName of parsedTags) {
      const normalizedName = tagName.toLowerCase();
      const existingTagId = existingTagMap.get(normalizedName);

      if (existingTagId) {
        tagIds.push(existingTagId);
        continue;
      }

      const { data: newTag, error: newTagError } = await supabase
        .from('tags')
        .insert({
          user_id: userId,
          name: tagName,
        } as never)
        .select('id, name')
        .single();

      if (newTagError) {
        throw newTagError;
      }

      const newTagId = (newTag as any)?.id as string | undefined;
      const newTagName = ((newTag as any)?.name as string | undefined) ?? tagName;

      if (!newTagId) {
        continue;
      }

      existingTagMap.set(newTagName.toLowerCase(), newTagId);
      tagIds.push(newTagId);
    }

    if (tagIds.length === 0) {
      return;
    }

    const { error: recipeTagsError } = await supabase
      .from('recipe_tags')
      .insert(tagIds.map((tagId) => ({ recipe_id: recipeId, tag_id: tagId })) as never);

    if (recipeTagsError) {
      throw recipeTagsError;
    }
  };

  const syncRecipeIngredients = async (recipeId: string, rows: IngredientRow[]) => {
    const validRows = rows.filter((row) => row.foodItemId);

    const { error: deleteError } = await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('recipe_id', recipeId);

    if (deleteError) {
      throw deleteError;
    }

    if (validRows.length === 0) {
      return;
    }

    const { error: insertError } = await supabase.from('recipe_ingredients').insert(
      validRows.map((row, index) => ({
        recipe_id: recipeId,
        food_item_id: row.foodItemId,
        quantity: parseFloat(row.quantity) || 1,
        unit: row.unit.trim() || null,
        display_order: index,
      })) as never,
    );

    if (insertError) {
      throw insertError;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validIngredientRows = ingredientRows.filter((row) => row.foodItemId);

    if (!showLegacyIngredientsField && validIngredientRows.length === 0) {
      toast.error('Füge mindestens eine Zutat hinzu');
      return;
    }

    setLoading(true);

    let uploadedImagePath: string | null = null;

    try {
      const user = await getSessionUser();

      if (!user) {
        toast.error('Du musst angemeldet sein, um ein Rezept zu speichern');
        return;
      }

      let nextImageUrl = recipe?.image_url || null;
      let previousImagePathToDelete: string | null = null;

      if (selectedImage) {
        const imagePath = createRecipeImagePath(user.id, selectedImage.name);
        const { error: uploadError } = await supabase.storage
          .from(RECIPE_IMAGE_BUCKET)
          .upload(imagePath, selectedImage, {
            cacheControl: '3600',
            contentType: selectedImage.type,
            upsert: false,
          });

        if (uploadError) {
          toast.error(uploadError.message || 'Rezeptbild konnte nicht hochgeladen werden');
          return;
        }

        uploadedImagePath = imagePath;
        previousImagePathToDelete = getRecipeImagePathFromUrl(recipe?.image_url || null);

        const {
          data: { publicUrl },
        } = supabase.storage.from(RECIPE_IMAGE_BUCKET).getPublicUrl(imagePath);

        nextImageUrl = publicUrl;
      } else if (removeImage) {
        nextImageUrl = null;
        previousImagePathToDelete = getRecipeImagePathFromUrl(recipe?.image_url || null);
      }

      const recipePayload = {
        name: formData.name,
        ingredients:
          validIngredientRows.length > 0
            ? rowsToLegacyIngredientsText(validIngredientRows)
            : formData.ingredients,
        preparation_steps: formData.preparation_steps.trim() || null,
        source_url: formData.source_url.trim() || null,
        prep_time: formData.prep_time.trim() || null,
        calories: formData.calories ? parseFloat(formData.calories) : null,
        protein: formData.protein ? parseFloat(formData.protein) : null,
        carbs: formData.carbs ? parseFloat(formData.carbs) : null,
        fats: formData.fats ? parseFloat(formData.fats) : null,
        serving_size: parseFloat(formData.serving_size) || 1,
        image_url: nextImageUrl,
        is_public: formData.is_public,
      };

      let savedRecipeId: string | null = null;

      if (isEditing && recipe) {
        const { error } = await supabase
          .from('recipes')
          .update(recipePayload as never)
          .eq('id', recipe.id)
          .eq('user_id', user.id);

        if (error) {
          toast.error(error.message);
          return;
        }

        savedRecipeId = recipe.id;
      } else {
        const { data, error } = await supabase
          .from('recipes')
          .insert({
            user_id: user.id,
            ...recipePayload,
          } as never)
          .select('id')
          .single();

        if (error) {
          toast.error(error.message);
          return;
        }

        savedRecipeId = (data as { id: string } | null)?.id ?? null;
      }

      if (!savedRecipeId) {
        toast.error('Rezept konnte nicht gespeichert werden');
        return;
      }

      if (previousImagePathToDelete && previousImagePathToDelete !== uploadedImagePath) {
        await supabase.storage.from(RECIPE_IMAGE_BUCKET).remove([previousImagePathToDelete]);
      }

      try {
        await syncRecipeTags(savedRecipeId, user.id, formData.tags);
        await syncRecipeIngredients(savedRecipeId, ingredientRows);
        toast.success(isEditing ? 'Rezept erfolgreich aktualisiert!' : 'Rezept erfolgreich erstellt!');
      } catch (tagError) {
        toast.error('Rezept gespeichert, aber Tags oder Zutaten konnten nicht aktualisiert werden');
      }

      onRecipeSaved();
    } catch (err) {
      if (uploadedImagePath) {
        await supabase.storage.from(RECIPE_IMAGE_BUCKET).remove([uploadedImagePath]);
      }

      toast.error(isEditing ? 'Rezept konnte nicht aktualisiert werden' : 'Rezept konnte nicht erstellt werden');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogContent className="sm:max-h-[90vh]">
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Rezept bearbeiten' : 'Neues Rezept erstellen'}</DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className='space-y-2'>
          <Label htmlFor="name">Rezeptname *</Label>
          <Input
            id="name"
            required
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
            placeholder="z. B. Gegrilltes Hähnchen mit Gemüse"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className='space-y-2'>
            <Label htmlFor="source_url">Rezept-URL</Label>
            <Input
              id="source_url"
              type="url"
              value={formData.source_url}
              onChange={(e) =>
                setFormData({ ...formData, source_url: e.target.value })
              }
              placeholder="https://..."
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor="prep_time">Zeit</Label>
            <Input
              id="prep_time"
              value={formData.prep_time}
              onChange={(e) =>
                setFormData({ ...formData, prep_time: e.target.value })
              }
              placeholder="z. B. 30 Min."
            />
          </div>
        </div>

        <div className='space-y-2'>
          <Label htmlFor="tags">Tags</Label>
          <Input
            id="tags"
            value={formData.tags}
            onChange={(e) =>
              setFormData({ ...formData, tags: e.target.value })
            }
            placeholder="z. B. proteinreich, Mittagessen"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="image">Rezeptbild</Label>

            <div className="flex items-center gap-2">
              {selectedImage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSelectedImage}
                  disabled={loading}
                >
                  Auswahl aufheben
                </Button>
              )}

              {!selectedImage && imagePreviewUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveImage}
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4" />
                  Bild entfernen
                </Button>
              )}
            </div>
          </div>

          {imagePreviewUrl ? (
            <div className="overflow-hidden rounded-xl border border-brand-card-border bg-brand-chip-neutral">
              <img
                src={imagePreviewUrl}
                alt="Rezeptvorschau"
                className="h-48 w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-brand-disabled bg-brand-app-bg text-sm text-brand-tertiary">
              Kein Bild ausgewählt
            </div>
          )}

          <Input
            id="image"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            disabled={loading}
          />

          <p className="text-xs text-brand-tertiary">
            Lade ein JPG-, PNG-, GIF- oder WEBP-Bild mit bis zu 5 MB hoch.
          </p>
        </div>

        {showLegacyIngredientsField && (
          <div className='space-y-2' >
            <Label htmlFor="ingredients">Alte Zutatenliste</Label>
            <Textarea
              id="ingredients"
              value={formData.ingredients}
              onChange={(e) =>
                setFormData({ ...formData, ingredients: e.target.value })
              }
              placeholder="Zutaten auflisten (eine pro Zeile):&#10;- 500g Hähnchenbrust&#10;- 2 Tassen Brokkoli&#10;- 3 EL Olivenöl"
              className="h-24"
            />
            <p className="text-xs text-brand-tertiary">
              Wird noch von der Einkaufsliste verwendet, bis du dieses Rezept unten mit der Lebensmitteldatenbank neu aufbaust.
            </p>
          </div>
        )}

        <div className='space-y-2'>
          <Label>Zutaten {showLegacyIngredientsField ? '(Lebensmitteldatenbank)' : '*'}</Label>
          <RecipeIngredientEditor rows={ingredientRows} onChange={setIngredientRows} />
        </div>

        <div className='space-y-2'>
          <Label htmlFor="preparation_steps">Zubereitungsschritte</Label>
          <Textarea
            id="preparation_steps"
            value={formData.preparation_steps}
            onChange={(e) =>
              setFormData({ ...formData, preparation_steps: e.target.value })
            }
            placeholder="Schritte zur Zubereitung (einer pro Zeile):&#10;1. Ofen auf 200°C vorheizen&#10;2. Hähnchen mit Salz und Pfeffer würzen"
            className="h-24"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className='space-y-2'>
            <Label htmlFor="serving_size">Portionsgröße</Label>
            <Input
              id="serving_size"
              type="number"
              step="0.5"
              min="1"
              value={formData.serving_size}
              onChange={(e) =>
                setFormData({ ...formData, serving_size: e.target.value })
              }
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor="calories">Kalorien (pro Portion)</Label>
            <Input
              id="calories"
              type="number"
              step="0.1"
              value={formData.calories}
              onChange={(e) =>
                setFormData({ ...formData, calories: e.target.value })
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className='space-y-2'>
            <Label htmlFor="protein">Protein (g)</Label>
            <Input
              id="protein"
              type="number"
              step="0.1"
              value={formData.protein}
              onChange={(e) =>
                setFormData({ ...formData, protein: e.target.value })
              }
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor="carbs">Kohlenhydrate (g)</Label>
            <Input
              id="carbs"
              type="number"
              step="0.1"
              value={formData.carbs}
              onChange={(e) =>
                setFormData({ ...formData, carbs: e.target.value })
              }
            />
          </div>
          <div className='space-y-2'  >
            <Label htmlFor="fats">Fett (g)</Label>
            <Input
              id="fats"
              type="number"
              step="0.1"
              value={formData.fats}
              onChange={(e) =>
                setFormData({ ...formData, fats: e.target.value })
              }
            />
          </div>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="is_public"
            checked={formData.is_public}
            onChange={(e) =>
              setFormData({ ...formData, is_public: e.target.checked })
            }
            className="w-4 h-4"
          />
          <label htmlFor="is_public" className="ml-2 text-sm">
            Dieses Rezept öffentlich machen
          </label>
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (isEditing ? 'Wird gespeichert...' : 'Wird erstellt...') : (isEditing ? 'Änderungen speichern' : 'Rezept erstellen')}
        </Button>
      </form>
    </DialogContent>
  );
}
