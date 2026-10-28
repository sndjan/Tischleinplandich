"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUp,
  Camera,
  Clock,
  Crop,
  ImagePlus,
  Link2,
  Minus,
  PencilLine,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import { StatusButton, useActionStatus } from "@/components/ui/status-button";
import { cn } from "@/lib/utils";
import type { Recipe } from "@/types/database";
import type { RecipeDraft } from "@/lib/recipe-draft";
import {
  draftFromEditable,
  editableFromDraft,
  editableFromRecipe,
  emptyEditableRecipe,
  formatIngredientAmount,
  type EditableRecipe,
} from "@/lib/editable-recipe";
import { saveRecipe, SaveRecipeError } from "@/lib/save-recipe";
import { refineRecipe } from "@/lib/recipe-ai-client";
import { queryKeys, useUserId } from "@/hooks/use-planner-data";
import { IngredientRowsEditor } from "./ingredient-rows-editor";
import { RecipeRefineSheet, type RefineExchange } from "./recipe-refine-sheet";
import { Switch } from "@/components/ui/controls";
import { ImageCropper } from "@/components/ui/image-cropper";
import { safeHttpUrl } from "@/lib/safe-links";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const HINT_DISMISSED_KEY = "weekly-meal-planner:editor-hint-dismissed";

type CoverState =
  | { kind: "keep"; previewUrl: string | null }
  | { kind: "remove"; previewUrl: null }
  // original: the photo before cropping, so cropping again starts from all of it.
  | { kind: "replace"; file: File; previewUrl: string; suggested: boolean; original?: File };

// A photo waiting in the cropper; objectUrl is set when src was made for it.
type CropTarget = { src: string; original: File | null; objectUrl: boolean };

interface RecipeEditorProps {
  recipe?: Recipe;
  recipeTags?: string[];
  draft?: RecipeDraft;
  // Cover photo picked by the AI from the import images.
  draftImage?: File;
  ingredientSuggestions: string[];
  existingTags: string[];
  onBack: () => void;
  onSaved: () => void;
}

const quickInstructions = (servings: number) => [
  servings === 4 ? "Für 2 Personen" : "Für 4 Personen",
  "Mehr Protein",
  "Vegan",
  "Leichter",
];

/**
 * Creating, checking and editing a recipe. It looks like the finished recipe; every
 * part is edited in place, and the AI can change it by chat.
 */
export function RecipeEditor({
  recipe,
  recipeTags = [],
  draft,
  draftImage,
  ingredientSuggestions,
  existingTags,
  onBack,
  onSaved,
}: RecipeEditorProps) {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const fromAi = Boolean(draft);

  const [initialValue] = useState<EditableRecipe>(() =>
    recipe
      ? editableFromRecipe(recipe, recipeTags)
      : draft
        ? editableFromDraft(draft)
        : emptyEditableRecipe(),
  );
  const [value, setValue] = useState(initialValue);
  const [cover, setCover] = useState<CoverState>(() =>
    draftImage
      ? { kind: "replace", file: draftImage, previewUrl: URL.createObjectURL(draftImage), suggested: true }
      : { kind: "keep", previewUrl: recipe?.image_url ?? null },
  );
  const [cropTarget, setCropTarget] = useState<CropTarget | null>(null);
  const [view, setView] = useState<"main" | "ingredients">("main");
  const [showHint, setShowHint] = useState(false);
  const [tagInputOpen, setTagInputOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [instruction, setInstruction] = useState("");
  const [pendingInstruction, setPendingInstruction] = useState<string | null>(null);
  const [exchanges, setExchanges] = useState<RefineExchange[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const undoSnapshots = useRef(new Map<string, EditableRecipe>());
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const nameRef = useRef<HTMLTextAreaElement | null>(null);
  const { status: saveStatus, run } = useActionStatus();

  useEffect(() => {
    try {
      setShowHint(!window.localStorage.getItem(HINT_DISMISSED_KEY));
    } catch {
      setShowHint(true);
    }
  }, []);

  // Frees the preview of a picked photo once it is replaced or removed.
  const changeCover = (next: CoverState) => {
    if (cover.kind === "replace") URL.revokeObjectURL(cover.previewUrl);
    setCover(next);
  };

  const update = (patch: Partial<EditableRecipe>) => setValue((current) => ({ ...current, ...patch }));

  const dismissHint = () => {
    setShowHint(false);
    try {
      window.localStorage.setItem(HINT_DISMISSED_KEY, "1");
    } catch {
      // Only means the hint shows again next time.
    }
  };

  const isDirty =
    JSON.stringify(value) !== JSON.stringify(initialValue) ||
    cover.kind === "remove" ||
    (cover.kind === "replace" && !cover.suggested);

  const handleBack = () => {
    if ((isDirty || fromAi) && saveStatus === "idle") {
      if (!window.confirm("Änderungen verwerfen?")) return;
    }
    onBack();
  };

  const handleCoverChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Keine gültige Bilddatei");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      toast.error("Bild ist größer als 5 MB");
      return;
    }

    // Every new photo goes through the cropper, so cards show what was chosen.
    setCropTarget({ src: URL.createObjectURL(file), original: file, objectUrl: true });
  };

  const openCropper = () => {
    if (cover.kind === "replace") {
      const source = cover.original ?? cover.file;
      setCropTarget({ src: URL.createObjectURL(source), original: source, objectUrl: true });
    } else if (cover.previewUrl) {
      setCropTarget({ src: cover.previewUrl, original: null, objectUrl: false });
    }
  };

  const closeCropper = () => {
    if (cropTarget?.objectUrl) URL.revokeObjectURL(cropTarget.src);
    setCropTarget(null);
  };

  const applyCrop = (file: File) => {
    changeCover({
      kind: "replace",
      file,
      previewUrl: URL.createObjectURL(file),
      suggested: false,
      original: cropTarget?.original ?? undefined,
    });
    closeCropper();
  };

  const addTag = (raw: string) => {
    const tags = raw
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .filter((tag) => !value.tags.some((existing) => existing.toLowerCase() === tag.toLowerCase()));

    if (tags.length > 0) update({ tags: [...value.tags, ...tags] });
    setTagInput("");
  };

  const tagSuggestions = useMemo(() => {
    const query = tagInput.trim().toLowerCase();
    return existingTags
      .filter((tag) => !value.tags.some((existing) => existing.toLowerCase() === tag.toLowerCase()))
      .filter((tag) => !query || tag.toLowerCase().includes(query))
      .slice(0, 6);
  }, [existingTags, tagInput, value.tags]);

  const sendInstruction = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pendingInstruction) return;

    setInstruction("");
    setPendingInstruction(trimmed);
    setSheetOpen(true);
    const before = value;

    try {
      const result = await refineRecipe(draftFromEditable(before), trimmed);
      const next: EditableRecipe = {
        ...editableFromDraft(result.draft),
        source_url: before.source_url,
        is_public: before.is_public,
      };
      const id = crypto.randomUUID();

      undoSnapshots.current.set(id, before);
      setValue(next);
      setExchanges((current) => [
        ...current,
        {
          id,
          instruction: trimmed,
          summary: result.summary || "Erledigt.",
          changes: result.changes,
          nutrition: {
            calories: [before.calories, next.calories],
            protein: [before.protein, next.protein],
          },
          undone: false,
        },
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ändern fehlgeschlagen");
      if (exchanges.length === 0) setSheetOpen(false);
    } finally {
      setPendingInstruction(null);
    }
  };

  const undoExchange = (id: string) => {
    const snapshot = undoSnapshots.current.get(id);
    if (!snapshot) return;

    setValue(snapshot);
    setExchanges((current) =>
      current.map((exchange) => (exchange.id === id ? { ...exchange, undone: true } : exchange)),
    );
  };

  const handleSave = async () => {
    if (!value.name.trim()) {
      toast.error("Gib dem Rezept einen Namen");
      nameRef.current?.focus();
      return;
    }

    if (!value.ingredients.some((row) => row.name.trim())) {
      toast.error("Mindestens eine Zutat fehlt");
      setView("ingredients");
      return;
    }

    try {
      const { tagsSaved } = await run(async () => {
        const result = await saveRecipe(
          value,
          cover.kind === "replace"
            ? { kind: "replace", file: cover.file }
            : cover.kind === "remove"
              ? { kind: "remove" }
              : { kind: "keep" },
          recipe,
        );
        await queryClient.invalidateQueries({ queryKey: queryKeys.recipes(userId ?? "") });
        return result;
      });

      if (!tagsSaved) toast.error("Gespeichert, aber Tags fehlgeschlagen");
      onSaved();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof SaveRecipeError ? error.message : "Speichern fehlgeschlagen");
    }
  };

  if (view === "ingredients") {
    return (
      <IngredientRowsEditor
        rows={value.ingredients}
        onChange={(ingredients) => update({ ingredients })}
        suggestions={ingredientSuggestions}
        servingSize={value.serving_size}
        onDone={() => {
          update({ ingredients: value.ingredients.filter((row) => row.name.trim() || row.quantity.trim()) });
          setView("main");
        }}
      />
    );
  }

  const ingredientRows = value.ingredients.filter((row) => row.name.trim() || row.quantity.trim());
  const coverUrl = cover.previewUrl;

  const composer = (
    <form
      className="space-y-2.5"
      onSubmit={(event) => {
        event.preventDefault();
        void sendInstruction(instruction);
      }}
    >
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {quickInstructions(value.serving_size).map((quick) => (
          <button
            key={quick}
            type="button"
            disabled={Boolean(pendingInstruction)}
            onClick={() => void sendInstruction(quick)}
            className="h-8 shrink-0 whitespace-nowrap rounded-full border border-brand-input-border bg-white px-3 text-[13px] font-semibold text-brand-ink transition-transform active:scale-95 disabled:opacity-50"
          >
            {quick}
          </button>
        ))}
      </div>
      <label
        htmlFor="refine-input"
        className="flex h-12 w-full min-w-0 items-center gap-2 rounded-full bg-brand-chip-neutral pl-3.5 pr-1.5"
      >
        <Sparkles className="size-4 shrink-0 text-brand-accent-dark" />
        <input
          id="refine-input"
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder={pendingInstruction ? "KI ändert das Rezept …" : "Mit KI ändern …"}
          disabled={Boolean(pendingInstruction)}
          enterKeyHint="send"
          className="h-full w-full min-w-0 flex-1 bg-transparent text-[15px] text-brand-ink outline-none placeholder:text-brand-secondary"
        />
        <button
          type="submit"
          aria-label="Senden"
          disabled={!instruction.trim() || Boolean(pendingInstruction)}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-accent-dark text-white transition-all active:scale-90 disabled:bg-brand-icon-muted"
        >
          {pendingInstruction ? (
            <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <ArrowUp className="size-4" strokeWidth={2.5} />
          )}
        </button>
      </label>
    </form>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <div className="mx-auto w-full max-w-2xl flex-1">
        <div
          className={cn(
            "relative w-full overflow-hidden bg-brand-chip-neutral sm:rounded-b-3xl",
            coverUrl ? "h-60" : "h-36",
          )}
        >
          {coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="" className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={handleBack}
              aria-label="Zurück"
              className="flex size-11 items-center justify-center rounded-full bg-white/95 text-brand-ink shadow-sm active:scale-95"
            >
              <ArrowLeft className="size-5" />
            </button>
            {coverUrl && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={openCropper}
                  aria-label="Bild zuschneiden"
                  className="flex size-11 items-center justify-center rounded-full bg-white/95 text-brand-ink shadow-sm active:scale-95"
                >
                  <Crop className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="flex h-11 items-center gap-1.5 rounded-full bg-white/95 px-3.5 text-sm font-semibold text-brand-ink shadow-sm active:scale-95"
                >
                  <Camera className="size-4" />
                  Bild ändern
                </button>
                <button
                  type="button"
                  onClick={() =>
                    changeCover(
                      recipe?.image_url
                        ? { kind: "remove", previewUrl: null }
                        : { kind: "keep", previewUrl: null },
                    )
                  }
                  aria-label="Bild entfernen"
                  className="flex size-11 items-center justify-center rounded-full bg-white/95 text-brand-ink shadow-sm active:scale-95"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            )}
          </div>
          {!coverUrl && (
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              className="absolute inset-x-0 bottom-8 mx-auto flex h-10 w-fit items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-brand-ink shadow-sm active:scale-95"
            >
              <ImagePlus className="size-4 text-brand-accent-dark" />
              Bild hinzufügen
            </button>
          )}
          {cover.kind === "replace" && cover.suggested && (
            <div className="absolute bottom-8 left-3 flex items-center gap-2">
              <span className="flex h-8 items-center gap-1.5 rounded-lg bg-white/95 px-2.5 text-xs font-bold text-brand-ink">
                <Sparkles className="size-3" />
                KI-Vorschlag
              </span>
              <button
                type="button"
                onClick={openCropper}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-brand-accent-dark px-2.5 text-xs font-bold text-white shadow-sm active:scale-95"
              >
                <Crop className="size-3" />
                Zuschneiden
              </button>
            </div>
          )}
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCoverChange}
          />
        </div>

        <main className="relative -mt-5 space-y-5 rounded-t-[22px] bg-white px-4 pb-6 pt-5">
          {showHint && (
            <div className="flex items-center gap-2 rounded-xl border border-brand-track bg-brand-accent-bg-light px-3 py-2 text-[13px] text-brand-accent-dark">
              <PencilLine className="size-4 shrink-0" />
              <span className="flex-1">Tippe auf etwas, um es zu ändern.</span>
              <button
                type="button"
                onClick={dismissHint}
                aria-label="Hinweis schließen"
                className="flex size-7 items-center justify-center rounded-full active:bg-black/5"
              >
                <X className="size-3.5" strokeWidth={2.5} />
              </button>
            </div>
          )}

          <div className="space-y-3">
            <AutoTextarea
              ref={nameRef}
              aria-label="Rezeptname"
              value={value.name}
              maxLength={200}
              onChange={(event) => update({ name: event.target.value.replace(/\n/g, " ") })}
              placeholder="Rezeptname"
              className="font-heading -mx-1 px-1 text-[26px] font-extrabold leading-tight text-brand-ink"
            />
            <div className="flex flex-wrap gap-2">
              <label className="flex h-9 items-center gap-1.5 rounded-full bg-brand-chip-neutral pl-3 pr-1 text-[13px] font-semibold focus-within:ring-2 focus-within:ring-brand-accent">
                <Clock className="size-3.5 shrink-0" />
                <input
                  aria-label="Zubereitungszeit"
                  value={value.prep_time}
                  onChange={(event) => update({ prep_time: event.target.value })}
                  placeholder="Zeit"
                  className="w-[4.5rem] bg-transparent outline-none placeholder:text-brand-secondary"
                />
              </label>
              <div className="flex h-9 items-center gap-1 rounded-full bg-brand-chip-neutral pl-3 pr-1 text-[13px] font-semibold">
                {value.serving_size} {value.serving_size === 1 ? "Portion" : "Portionen"}
                <button
                  type="button"
                  aria-label="Weniger Portionen"
                  disabled={value.serving_size <= 1}
                  onClick={() => update({ serving_size: Math.max(1, value.serving_size - 1) })}
                  className="ml-1 flex size-7 items-center justify-center rounded-full bg-white active:scale-90 disabled:opacity-40"
                >
                  <Minus className="size-3" strokeWidth={3} />
                </button>
                <button
                  type="button"
                  aria-label="Mehr Portionen"
                  onClick={() => update({ serving_size: value.serving_size + 1 })}
                  className="flex size-7 items-center justify-center rounded-full bg-white active:scale-90"
                >
                  <Plus className="size-3" strokeWidth={3} />
                </button>
              </div>
              {safeHttpUrl(value.source_url) && (
                <a
                  href={safeHttpUrl(value.source_url)!}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-9 max-w-[12rem] items-center gap-1.5 rounded-full bg-brand-chip-neutral px-3 text-[13px] font-semibold text-brand-ink no-underline"
                >
                  <Link2 className="size-3.5 shrink-0" />
                  <span className="truncate">{hostOf(value.source_url)}</span>
                </a>
              )}
            </div>
          </div>

          <section aria-label="Nährwerte pro Portion" className="space-y-2">
            <div className="grid grid-cols-4 gap-2">
              <NutritionField label="kcal" value={value.calories} onChange={(calories) => update({ calories })} />
              <NutritionField label="Protein" suffix="g" accent value={value.protein} onChange={(protein) => update({ protein })} />
              <NutritionField label="Carbs" suffix="g" value={value.carbs} onChange={(carbs) => update({ carbs })} />
              <NutritionField label="Fett" suffix="g" value={value.fats} onChange={(fats) => update({ fats })} />
            </div>
            <p className="flex items-center gap-1.5 text-xs text-brand-secondary">
              {fromAi && <Sparkles className="size-3" />}
              {fromAi ? "Pro Portion, von der KI geschätzt" : "Pro Portion"}
            </p>
          </section>

          <section aria-label="Tags" className="flex flex-wrap items-center gap-2">
            {value.tags.map((tag) => (
              <span
                key={tag}
                className="flex h-8 items-center gap-0.5 rounded-full bg-brand-accent-bg pl-3 pr-1 text-[13px] font-bold text-brand-accent-dark"
              >
                {tag}
                <button
                  type="button"
                  aria-label={`Tag ${tag} entfernen`}
                  onClick={() => update({ tags: value.tags.filter((entry) => entry !== tag) })}
                  className="flex size-6 items-center justify-center rounded-full active:bg-black/5"
                >
                  <X className="size-3" strokeWidth={3} />
                </button>
              </span>
            ))}
            {tagInputOpen ? (
              <input
                autoFocus
                aria-label="Neuer Tag"
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault();
                    addTag(tagInput);
                  } else if (event.key === "Escape") {
                    setTagInputOpen(false);
                  }
                }}
                onBlur={() => {
                  addTag(tagInput);
                  setTagInputOpen(false);
                }}
                placeholder="Tag eingeben"
                className="h-8 w-32 rounded-full border border-brand-accent px-3 text-[13px] outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => setTagInputOpen(true)}
                className="flex h-8 items-center gap-1 rounded-full border border-dashed border-brand-disabled px-3 text-[13px] font-semibold text-brand-secondary active:scale-95"
              >
                <Plus className="size-3" strokeWidth={3} />
                Tag
              </button>
            )}
            {tagInputOpen && tagSuggestions.length > 0 && (
              <div className="flex w-full flex-wrap gap-1.5">
                {tagSuggestions.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => addTag(tag)}
                    className="h-7 rounded-full border border-brand-track bg-white px-2.5 text-xs font-semibold text-brand-accent-dark active:scale-95"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-1">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-heading text-lg font-extrabold">
                Zutaten{" "}
                {ingredientRows.length > 0 && (
                  <span className="font-bold text-brand-secondary">· {ingredientRows.length}</span>
                )}
              </h2>
              <button
                type="button"
                onClick={() => setView("ingredients")}
                className="h-9 rounded-lg px-2.5 text-sm font-semibold text-brand-accent-dark active:bg-brand-accent-bg"
              >
                Bearbeiten
              </button>
            </div>
            {ingredientRows.length === 0 ? (
              <button
                type="button"
                onClick={() => setView("ingredients")}
                className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-brand-disabled text-sm font-semibold text-brand-accent-dark active:scale-[0.98]"
              >
                <Plus className="size-4" strokeWidth={2.5} />
                Zutaten hinzufügen
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setView("ingredients")}
                className="block w-full text-left"
                aria-label="Zutaten bearbeiten"
              >
                {ingredientRows.map((row) => (
                  <span
                    key={row.id}
                    className="flex gap-3 border-b border-brand-divider py-2.5 text-[15px] last:border-b-0"
                  >
                    <span className="w-[4.5rem] shrink-0 font-bold">{formatIngredientAmount(row)}</span>
                    <span>{row.name}</span>
                  </span>
                ))}
              </button>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-extrabold">Zubereitung</h2>
            {value.steps.map((step, index) => (
              <div key={index} className="group flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-accent-bg text-[13px] font-bold text-brand-accent-dark">
                  {index + 1}
                </span>
                <AutoTextarea
                  aria-label={`Schritt ${index + 1}`}
                  value={step}
                  onChange={(event) =>
                    update({ steps: value.steps.map((entry, i) => (i === index ? event.target.value : entry)) })
                  }
                  className="-my-0.5 px-1 py-0.5 text-[15px] leading-relaxed"
                />
                <button
                  type="button"
                  aria-label={`Schritt ${index + 1} entfernen`}
                  onClick={() => update({ steps: value.steps.filter((_, i) => i !== index) })}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-brand-muted active:bg-black/5"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => update({ steps: [...value.steps, ""] })}
              className="flex h-10 items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-brand-accent-dark active:bg-brand-accent-bg"
            >
              <Plus className="size-4" strokeWidth={2.5} />
              Schritt hinzufügen
            </button>
          </section>

          <section className="space-y-3 rounded-2xl bg-brand-app-bg p-3.5">
            <label className="block space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-brand-secondary">Link zur Quelle</span>
              <input
                type="url"
                value={value.source_url}
                onChange={(event) => update({ source_url: event.target.value })}
                placeholder="https://…"
                className="h-11 w-full rounded-xl border border-brand-input-border bg-white px-3 text-[15px] outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent-bg"
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="text-[15px] font-semibold">Öffentlich</span>
              <Switch
                checked={value.is_public}
                onChange={(is_public) => update({ is_public })}
                label="Öffentlich"
              />
            </label>
          </section>
        </main>
      </div>

      <footer className="sticky bottom-0 z-30 border-t border-brand-card-border bg-white shadow-[0_-6px_16px_rgba(28,43,34,0.06)]">
        <div className="mx-auto w-full max-w-2xl space-y-2.5 px-4 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {!sheetOpen && composer}
          <StatusButton
            type="button"
            onClick={() => void handleSave()}
            status={saveStatus}
            pendingLabel="Speichert …"
            successLabel="Gespeichert"
            className="h-12 w-full rounded-xl text-base font-bold"
          >
            {recipe ? "Änderungen speichern" : "Rezept speichern"}
          </StatusButton>
        </div>
      </footer>

      {sheetOpen && (
        <RecipeRefineSheet
          exchanges={exchanges}
          pendingInstruction={pendingInstruction}
          onUndo={undoExchange}
          onClose={() => setSheetOpen(false)}
          composer={composer}
        />
      )}

      {cropTarget && <ImageCropper src={cropTarget.src} onCancel={closeCropper} onDone={applyCrop} />}
    </div>
  );
}

function NutritionField({
  label,
  suffix,
  value,
  onChange,
  accent,
}: {
  label: string;
  suffix?: string;
  value: string;
  onChange: (value: string) => void;
  accent?: boolean;
}) {
  return (
    <label className="flex flex-col items-center gap-0.5 rounded-2xl bg-brand-stat-bg px-1 py-2.5 focus-within:ring-2 focus-within:ring-brand-accent">
      <span className="flex items-baseline justify-center">
        <input
          inputMode="decimal"
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/[^\d.,]/g, ""))}
          placeholder="–"
          className={cn(
            "w-12 bg-transparent text-center text-lg font-bold outline-none placeholder:text-brand-muted",
            accent ? "text-brand-accent-dark" : "text-brand-ink",
          )}
          style={{ width: `${Math.max(1.5, value.length + 0.5)}ch` }}
        />
        {suffix && value && (
          <span className={cn("text-lg font-bold", accent ? "text-brand-accent-dark" : "text-brand-ink")}>
            {" "}
            {suffix}
          </span>
        )}
      </span>
      <span className="text-xs text-brand-secondary">{label}</span>
    </label>
  );
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
