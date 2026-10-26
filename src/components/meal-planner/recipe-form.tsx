'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient, getSessionUser } from '@/lib/supabase/client';
import { createRecipeImagePath, getRecipeImagePathFromUrl, RECIPE_IMAGE_BUCKET } from '../../lib/recipe-images';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Recipe } from '@/types/database';
import type { RecipeDraft } from '@/lib/recipe-draft';
import { Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { SubPage } from './sub-page';

const FORM_ID = 'recipe-form';

interface RecipeFormProps {
  onBack: () => void;
  onRecipeSaved: () => void;
  recipe?: Recipe | null;
  draft?: RecipeDraft | null;
  // Cover photo picked during AI import; preselected like a manually chosen image.
  draftImage?: File | null;
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

const getFormDataFromDraft = (draft: RecipeDraft): RecipeFormData => ({
  name: draft.name,
  ingredients: draft.ingredients,
  preparation_steps: draft.preparation_steps,
  source_url: draft.source_url,
  prep_time: draft.prep_time,
  tags: draft.tags.join(', '),
  calories: draft.calories?.toString() || '',
  protein: draft.protein?.toString() || '',
  carbs: draft.carbs?.toString() || '',
  fats: draft.fats?.toString() || '',
  serving_size: draft.serving_size.toString(),
  is_public: false,
});

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

export function RecipeForm({ onBack, onRecipeSaved, recipe, draft, draftImage }: RecipeFormProps) {
  const activeDraft = recipe ? null : draft ?? null;
  const activeDraftImage = activeDraft ? draftImage ?? null : null;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(() =>
    activeDraft ? getFormDataFromDraft(activeDraft) : getFormDataFromRecipe(recipe),
  );
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(recipe?.image_url || null);
  const [removeImage, setRemoveImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);

  const supabase = createClient();
  const isEditing = Boolean(recipe);

  const clearPreviewObjectUrl = () => {
    if (!previewObjectUrlRef.current) {
      return;
    }

    URL.revokeObjectURL(previewObjectUrlRef.current);
    previewObjectUrlRef.current = null;
  };

  useEffect(() => {
    clearPreviewObjectUrl();
    setFormData(activeDraft ? getFormDataFromDraft(activeDraft) : getFormDataFromRecipe(recipe));
    setRemoveImage(false);

    if (activeDraftImage) {
      const objectUrl = URL.createObjectURL(activeDraftImage);
      previewObjectUrlRef.current = objectUrl;
      setSelectedImage(activeDraftImage);
      setImagePreviewUrl(objectUrl);
    } else {
      setSelectedImage(null);
      setImagePreviewUrl(recipe?.image_url || null);
    }

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
    const loadRecipeTags = async () => {
      if (!recipe) {
        setFormData((prev) => ({ ...prev, tags: activeDraft ? activeDraft.tags.join(', ') : '' }));
        return;
      }

      const { data, error } = await supabase
        .from('recipe_tags')
        .select('tags(name)')
        .eq('recipe_id', recipe.id);

      if (error) {
        toast.error('Tags konnten nicht geladen werden');
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
      toast.error('Keine gültige Bilddatei');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      toast.error('Bild ist größer als 5 MB');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let uploadedImagePath: string | null = null;

    try {
      const user = await getSessionUser();

      if (!user) {
        toast.error('Nicht angemeldet');
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
          toast.error(uploadError.message || 'Bild-Upload fehlgeschlagen');
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
        ingredients: formData.ingredients,
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
        toast.error('Speichern fehlgeschlagen');
        return;
      }

      if (previousImagePathToDelete && previousImagePathToDelete !== uploadedImagePath) {
        await supabase.storage.from(RECIPE_IMAGE_BUCKET).remove([previousImagePathToDelete]);
      }

      try {
        await syncRecipeTags(savedRecipeId, user.id, formData.tags);
        toast.success(isEditing ? 'Gespeichert' : 'Rezept erstellt');
      } catch (tagError) {
        toast.error('Gespeichert, Tags fehlgeschlagen');
      }

      onRecipeSaved();
    } catch (err) {
      if (uploadedImagePath) {
        await supabase.storage.from(RECIPE_IMAGE_BUCKET).remove([uploadedImagePath]);
      }

      toast.error('Speichern fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SubPage
      title={isEditing ? 'Rezept bearbeiten' : activeDraft ? 'Rezept prüfen' : 'Neues Rezept'}
      onBack={onBack}
      footer={
        <Button type="submit" form={FORM_ID} className="w-full" disabled={loading}>
          {loading ? 'Speichert…' : isEditing ? 'Speichern' : 'Erstellen'}
        </Button>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4">
        <div className='space-y-2'>
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            required
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
            placeholder="z. B. Hähnchen mit Gemüse"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className='space-y-2'>
            <Label htmlFor="source_url">Link</Label>
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
            <Label htmlFor="image">Bild</Label>

            <div className="flex items-center gap-2">
              {selectedImage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSelectedImage}
                  disabled={loading}
                >
                  Zurücksetzen
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
                  Entfernen
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
              Kein Bild
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
            JPG, PNG, GIF oder WEBP, max. 5 MB
          </p>
        </div>

        <div className='space-y-2'>
          <Label htmlFor="ingredients">Zutaten *</Label>
          <Textarea
            id="ingredients"
            required
            value={formData.ingredients}
            onChange={(e) =>
              setFormData({ ...formData, ingredients: e.target.value })
            }
            placeholder="Eine Zutat pro Zeile&#10;500 g Hähnchenbrust&#10;3 EL Olivenöl"
            className="h-32"
          />
        </div>

        <div className='space-y-2'>
          <Label htmlFor="preparation_steps">Zubereitung</Label>
          <Textarea
            id="preparation_steps"
            value={formData.preparation_steps}
            onChange={(e) =>
              setFormData({ ...formData, preparation_steps: e.target.value })
            }
            placeholder="Ein Schritt pro Zeile"
            className="h-24"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className='space-y-2'>
            <Label htmlFor="serving_size">Portionen</Label>
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
            <Label htmlFor="calories">kcal / Portion</Label>
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
            <Label htmlFor="carbs">Carbs (g)</Label>
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
            Öffentlich
          </label>
        </div>
      </form>
    </SubPage>
  );
}
