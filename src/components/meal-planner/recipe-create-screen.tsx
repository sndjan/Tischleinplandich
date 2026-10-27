"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  ClipboardPaste,
  Download,
  FileText,
  Lightbulb,
  Link2,
  Mic,
  PencilLine,
  Plus,
  Share,
  Sparkles,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  RECIPE_EXTRACT_MAX_IMAGE_BYTES,
  RECIPE_EXTRACT_MAX_IMAGES,
  RECIPE_EXTRACT_MAX_PDF_BYTES,
  type RecipeDraft,
  type RecipeStreamEvent,
  type RecipeStreamStage,
} from "@/lib/recipe-draft";
import { streamRecipe } from "@/lib/recipe-ai-client";
import { createAttachedImage, downscaleImage, type AttachedImage } from "@/lib/image-utils";
import { splitFirstUrl, type SharedContent } from "@/lib/share-target";
import { SubPage } from "./sub-page";
import { Stepper, Switch } from "@/components/ui/controls";
import { RecipeAiProgress, type ProgressStep } from "./recipe-ai-progress";

type CreateMode = "import" | "idea" | "manual";

const MODES: { value: CreateMode; label: string; Icon: typeof Download }[] = [
  { value: "import", label: "Importieren", Icon: Download },
  { value: "idea", label: "Aus Idee", Icon: Lightbulb },
  { value: "manual", label: "Manuell", Icon: PencilLine },
];

const IDEA_PREFERENCES = [
  "Proteinreich",
  "Unter 30 Min.",
  "Vegetarisch",
  "Vegan",
  "Meal Prep",
  "Wenig Abwasch",
];

type ProgressState = {
  linkStep: ProgressStep | null;
  stage: RecipeStreamStage;
  draft: RecipeDraft | null;
};

interface RecipeCreateScreenProps {
  onBack: () => void;
  onManual: () => void;
  onDraftReady: (draft: RecipeDraft, cover?: File) => void;
  // Shared from another app; reading starts right away.
  sharedContent?: SharedContent;
  // What is left of today's targets, e.g. "820 kcal, 54 g Protein".
  targetHint?: string | null;
}

const base64ToFile = (data: string, mediaType: string) => {
  const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
  const extension = mediaType.split("/")[1] ?? "jpg";
  return new File([bytes], `cover.${extension}`, { type: mediaType });
};

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export function RecipeCreateScreen({
  onBack,
  onManual,
  onDraftReady,
  sharedContent,
  targetHint,
}: RecipeCreateScreenProps) {
  const [mode, setMode] = useState<CreateMode>("import");
  const [text, setText] = useState(sharedContent?.text ?? "");
  const [link, setLink] = useState(sharedContent?.url ?? "");
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [pdf, setPdf] = useState<File | null>(null);
  const [ideaText, setIdeaText] = useState("");
  const [preferences, setPreferences] = useState<string[]>([]);
  const [servings, setServings] = useState(2);
  const [matchTargets, setMatchTargets] = useState(Boolean(targetHint));
  const [progress, setProgress] = useState<ProgressState | null>(null);

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const imagesRef = useRef(images);
  const pdfRef = useRef(pdf);
  const abortRef = useRef<AbortController | null>(null);
  const autoStartedRef = useRef(false);

  imagesRef.current = images;
  pdfRef.current = pdf;

  useEffect(
    () => () => {
      abortRef.current?.abort();
      imagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    },
    [],
  );

  const addFiles = useCallback(async (files: File[]) => {
    const pdfFile = files.find((file) => file.type === "application/pdf");
    if (pdfFile) {
      if (pdfFile.size > RECIPE_EXTRACT_MAX_PDF_BYTES) {
        toast.error("PDF darf höchstens 4 MB groß sein");
      } else {
        pdfRef.current = pdfFile;
        setPdf(pdfFile);
      }
    }

    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    const freeSlots = RECIPE_EXTRACT_MAX_IMAGES - imagesRef.current.length;
    if (imageFiles.length > freeSlots) {
      toast.error(`Maximal ${RECIPE_EXTRACT_MAX_IMAGES} Bilder`);
    }

    const added: AttachedImage[] = [];
    for (const file of imageFiles.slice(0, Math.max(0, freeSlots))) {
      const scaled = await downscaleImage(file);
      if (scaled.size > RECIPE_EXTRACT_MAX_IMAGE_BYTES) {
        toast.error("Bilder dürfen höchstens 5 MB groß sein");
        continue;
      }
      added.push(createAttachedImage(scaled));
    }

    imagesRef.current = [...imagesRef.current, ...added];
    setImages((current) => [...current, ...added]);
  }, []);

  const removeImage = (id: string) =>
    setImages((current) => {
      const removed = current.find((image) => image.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((image) => image.id !== id);
    });

  // A pasted or typed bare link becomes a link chip instead of text.
  const handleTextChange = (value: string) => {
    const { url, rest } = splitFirstUrl(value);
    if (url && !link && rest === "") {
      setLink(url);
      setText("");
      return;
    }
    setText(value);
  };

  const handlePaste = (event: React.ClipboardEvent) => {
    const files = Array.from(event.clipboardData.files);
    if (files.length === 0 || mode !== "import") return;

    if (!event.clipboardData.getData("text")) {
      event.preventDefault();
    }
    void addFiles(files);
  };

  const handlePasteButton = async () => {
    try {
      if (navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        const files: File[] = [];
        let pastedText = "";

        for (const item of items) {
          const imageType = item.types.find((type) => type.startsWith("image/"));
          if (imageType) {
            const blob = await item.getType(imageType);
            files.push(new File([blob], "eingefuegt.png", { type: imageType }));
          } else if (item.types.includes("text/plain")) {
            pastedText += await (await item.getType("text/plain")).text();
          }
        }

        if (files.length > 0) await addFiles(files);
        if (pastedText) handleTextChange(text ? `${text}\n${pastedText}` : pastedText);
        if (files.length === 0 && !pastedText) toast("Zwischenablage ist leer");
        return;
      }

      const pastedText = await navigator.clipboard.readText();
      if (pastedText) handleTextChange(text ? `${text}\n${pastedText}` : pastedText);
    } catch {
      toast("Lange ins Textfeld tippen und „Einfügen“ wählen");
    }
  };

  const canSubmit =
    mode === "import"
      ? Boolean(text.trim() || link || images.length > 0 || pdf)
      : mode === "idea"
        ? Boolean(ideaText.trim() || preferences.length > 0)
        : false;

  const start = useCallback(
    async (submitMode: "import" | "idea") => {
      const body = new FormData();
      body.append("mode", submitMode);

      if (submitMode === "import") {
        // A link typed inside a longer note still counts as the link.
        const { url, rest } = link ? { url: link, rest: text } : splitFirstUrl(text);
        body.append("text", rest);
        body.append("url", url);
        imagesRef.current.forEach((image) => body.append("images", image.file));
        if (pdfRef.current) body.append("pdf", pdfRef.current);
      } else {
        body.append("text", ideaText);
        preferences.forEach((preference) => body.append("preferences", preference));
        body.append("servings", String(servings));
        if (matchTargets && targetHint) body.append("targetHint", targetHint);
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setProgress({ linkStep: null, stage: "reading", draft: null });

      const handleEvent = (event: RecipeStreamEvent) => {
        if (event.type === "step") {
          setProgress((current) =>
            current
              ? { ...current, linkStep: { label: event.label, status: event.status } }
              : current,
          );
        } else if (event.type === "partial") {
          setProgress((current) =>
            current ? { ...current, stage: event.stage, draft: event.draft } : current,
          );
        }
      };

      try {
        const result = await streamRecipe(body, handleEvent, controller.signal);
        const cover =
          result.coverImageIndex !== null
            ? imagesRef.current[result.coverImageIndex]?.file
            : result.coverImage
              ? base64ToFile(result.coverImage.data, result.coverImage.mediaType)
              : undefined;
        onDraftReady(result.draft, cover);
      } catch (error) {
        if (controller.signal.aborted) return;
        setProgress(null);
        toast.error(error instanceof Error ? error.message : "Kein Rezept erkannt");
      }
    },
    [link, text, ideaText, preferences, servings, matchTargets, targetHint, onDraftReady],
  );

  useEffect(() => {
    if (!sharedContent || autoStartedRef.current) return;
    autoStartedRef.current = true;

    void (async () => {
      if (sharedContent.files.length > 0) await addFiles(sharedContent.files);
      if (sharedContent.url || sharedContent.files.length > 0 || sharedContent.text) {
        void start("import");
      }
    })();
    // Only once, for the content this screen was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancelProgress = () => {
    abortRef.current?.abort();
    setProgress(null);
  };

  if (progress) {
    const steps: ProgressStep[] = [];
    if (progress.linkStep) steps.push(progress.linkStep);
    if (images.length > 0 || pdf) {
      const label =
        [images.length > 0 ? `${images.length} ${images.length === 1 ? "Bild" : "Bilder"}` : "", pdf ? "PDF" : ""]
          .filter(Boolean)
          .join(" und ");
      steps.push({
        label: progress.stage === "reading" ? `${label} wird gelesen …` : `${label} gelesen`,
        status: progress.stage === "reading" ? "active" : "done",
      });
    }

    return (
      <RecipeAiProgress
        title={mode === "idea" ? "Wird geschrieben …" : "Wird erkannt …"}
        extraSteps={steps}
        stage={progress.stage}
        draft={progress.draft}
        isIdea={mode === "idea"}
        onCancel={cancelProgress}
      />
    );
  }

  return (
    <SubPage
      title="Neues Rezept"
      onBack={onBack}
      onPaste={handlePaste}
      footer={
        mode === "manual" ? undefined : (
          <Button
            className="h-12 w-full rounded-xl text-base font-bold"
            disabled={!canSubmit}
            onClick={() => void start(mode === "idea" ? "idea" : "import")}
          >
            <Sparkles className="size-5" />
            {mode === "idea" ? "Rezept schreiben" : "Rezept erkennen"}
          </Button>
        )
      }
    >
      <div
        role="tablist"
        aria-label="Art"
        className="grid grid-cols-3 gap-1 rounded-2xl bg-brand-chip-neutral p-1"
      >
        {MODES.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={cn(
              "flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-brand-secondary transition-all active:scale-[0.97]",
              mode === value && "bg-white text-brand-accent-dark shadow-sm",
            )}
          >
            {mode === value && <Icon className="size-4" />}
            {label}
          </button>
        ))}
      </div>

      {sharedContent && (
        <div className="flex items-center gap-2 rounded-xl bg-brand-accent-bg px-3 py-2.5 text-sm font-semibold text-brand-accent-dark">
          <Share className="size-4" />
          Aus einer anderen App geteilt
        </div>
      )}

      {mode === "import" && (
        <>
          <section className="space-y-3 rounded-2xl border-[1.5px] border-brand-accent bg-white p-3.5 shadow-[0_0_0_4px_#eaf3ec]">
            <label
              htmlFor="smart-input"
              className="block text-xs font-bold uppercase tracking-wide text-brand-secondary"
            >
              Alles hier rein
            </label>
            <textarea
              id="smart-input"
              value={text}
              onChange={(event) => handleTextChange(event.target.value)}
              placeholder="Link, Rezepttext oder Notiz einfügen …"
              rows={3}
              className="w-full resize-none border-0 bg-transparent p-0 text-[15px] leading-relaxed text-brand-ink outline-none placeholder:text-brand-muted"
            />

            {link && (
              <div className="animate-fade-up flex items-center gap-2.5 rounded-xl border border-brand-track bg-brand-stat-bg p-2.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-accent-bg text-brand-accent-dark">
                  <Link2 className="size-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-brand-ink">{hostOf(link)}</p>
                  <p className="truncate text-xs text-brand-secondary">{link}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setLink("")}
                  aria-label="Link entfernen"
                  className="flex size-8 items-center justify-center rounded-full text-brand-secondary active:bg-black/5"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}

            {pdf && (
              <div className="animate-fade-up flex items-center gap-2.5 rounded-xl border border-brand-card-border bg-brand-chip-neutral p-2.5 text-sm">
                <FileText className="size-[18px] shrink-0 text-brand-secondary" />
                <span className="min-w-0 flex-1 truncate font-medium">{pdf.name}</span>
                <button
                  type="button"
                  onClick={() => setPdf(null)}
                  aria-label="PDF entfernen"
                  className="flex size-8 items-center justify-center rounded-full text-brand-secondary active:bg-black/5"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}

            {images.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {images.map((image) => (
                  <div
                    key={image.id}
                    className="animate-pop-in relative aspect-square overflow-hidden rounded-xl bg-brand-chip-neutral"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.previewUrl} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(image.id)}
                      aria-label="Bild entfernen"
                      className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
                {images.length < RECIPE_EXTRACT_MAX_IMAGES && (
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    aria-label="Foto hinzufügen"
                    className="flex aspect-square items-center justify-center rounded-xl border-[1.5px] border-dashed border-brand-disabled bg-brand-app-bg-alt text-brand-secondary active:scale-95"
                  >
                    <Plus className="size-5" />
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-brand-divider pt-3">
              <AttachButton onClick={() => void handlePasteButton()} Icon={ClipboardPaste}>
                Einfügen
              </AttachButton>
              <AttachButton onClick={() => photoInputRef.current?.click()} Icon={Plus}>
                Fotos
              </AttachButton>
              <AttachButton onClick={() => cameraInputRef.current?.click()} Icon={Camera}>
                Kamera
              </AttachButton>
              <AttachButton onClick={() => pdfInputRef.current?.click()} Icon={FileText}>
                PDF
              </AttachButton>
            </div>

            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                void addFiles(files);
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                void addFiles(files);
              }}
            />
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                void addFiles(files);
              }}
            />
          </section>

          <div className="flex items-start gap-2.5 px-1">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-accent-dark" />
            <p className="text-[13px] leading-relaxed text-brand-secondary">
              Alles zusammen ergibt <strong className="text-brand-ink">ein</strong> Rezept. Zeigt
              ein Foto das fertige Gericht, wird es als Titelbild vorgeschlagen.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-brand-card-border bg-white p-3.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-accent-bg text-brand-accent-dark">
              <Share className="size-[18px]" />
            </div>
            <p className="text-[13px] leading-snug text-brand-secondary">
              Schneller: In Instagram, Chrome oder Fotos auf{" "}
              <strong className="text-brand-ink">Teilen › Essensplaner</strong> tippen (Android,
              App installiert).
            </p>
          </div>
        </>
      )}

      {mode === "idea" && (
        <>
          <section className="space-y-2.5 rounded-2xl border-[1.5px] border-brand-accent bg-white p-3.5 shadow-[0_0_0_4px_#eaf3ec]">
            <label
              htmlFor="idea-input"
              className="block text-xs font-bold uppercase tracking-wide text-brand-secondary"
            >
              Was möchtest du kochen?
            </label>
            <textarea
              id="idea-input"
              value={ideaText}
              onChange={(event) => setIdeaText(event.target.value)}
              placeholder="z. B. Habe noch Kichererbsen, Spinat und Joghurt. Etwas Warmes, max. 25 Min."
              rows={4}
              className="w-full resize-none border-0 bg-transparent p-0 text-base leading-relaxed text-brand-ink outline-none placeholder:text-brand-muted"
            />
            <div className="flex items-center justify-end gap-1.5 text-xs text-brand-secondary">
              <Mic className="size-3.5" />
              Diktieren geht über das Mikrofon der Tastatur
            </div>
          </section>

          <div className="space-y-2.5">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-secondary">
              Schnell ergänzen
            </p>
            <div className="flex flex-wrap gap-2">
              {IDEA_PREFERENCES.map((preference) => {
                const active = preferences.includes(preference);
                return (
                  <button
                    key={preference}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setPreferences((current) =>
                        active
                          ? current.filter((entry) => entry !== preference)
                          : [...current, preference],
                      )
                    }
                    className={cn(
                      "h-9 rounded-full border px-3 text-[13px] font-semibold transition-all active:scale-95",
                      active
                        ? "border-brand-accent bg-brand-accent-bg text-brand-accent-dark"
                        : "border-brand-input-border bg-white text-brand-ink",
                    )}
                  >
                    {preference}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-brand-card-border bg-white">
            <div className="flex items-center justify-between border-b border-brand-divider px-3.5 py-3">
              <span className="text-[15px] font-semibold">Portionen</span>
              <Stepper value={servings} onChange={setServings} min={1} max={12} />
            </div>
            <label
              className={cn(
                "flex items-center justify-between gap-3 px-3.5 py-3",
                !targetHint && "opacity-60",
              )}
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold">An meine Ziele anpassen</span>
                <span className="text-xs text-brand-secondary">
                  {targetHint ? `Rest für heute: ${targetHint}` : "Heute ist schon alles verplant"}
                </span>
              </span>
              <Switch
                checked={matchTargets && Boolean(targetHint)}
                disabled={!targetHint}
                onChange={setMatchTargets}
                label="An meine Ziele anpassen"
              />
            </label>
          </div>
        </>
      )}

      {mode === "manual" && (
        <div className="space-y-4 rounded-2xl border border-brand-card-border bg-white p-5 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-accent-bg text-brand-accent-dark">
            <PencilLine className="size-6" />
          </div>
          <div className="space-y-1">
            <p className="font-heading text-lg font-bold">Selbst eingeben</p>
            <p className="text-sm text-brand-secondary">
              Öffnet ein leeres Rezept. Die KI kann es danach trotzdem anpassen.
            </p>
          </div>
          <Button className="h-12 w-full rounded-xl text-base font-bold" onClick={onManual}>
            Leeres Rezept öffnen
          </Button>
        </div>
      )}
    </SubPage>
  );
}

function AttachButton({
  onClick,
  Icon,
  children,
}: {
  onClick: () => void;
  Icon: typeof Plus;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 items-center gap-1.5 rounded-full border border-brand-input-border bg-white px-3 text-[13px] font-semibold text-brand-ink transition-all active:scale-95 active:bg-brand-accent-bg"
    >
      <Icon className="size-4" />
      {children}
    </button>
  );
}
