"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  RECIPE_EXTRACT_MAX_IMAGE_BYTES,
  RECIPE_EXTRACT_MAX_IMAGES,
  RECIPE_EXTRACT_MAX_PDF_BYTES,
  type RecipeDraft,
} from "@/lib/recipe-draft";
import { FileText, ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import toast from "react-hot-toast";
import { SubPage } from "./sub-page";

const FORM_ID = "recipe-ai-import-form";

interface RecipeAiImportProps {
  onBack: () => void;
  // coverImage is the photo picked as the recipe's picture; the AI never sees it.
  onDraftReady: (draft: RecipeDraft, coverImage?: File) => void;
}

type AttachedImage = {
  id: string;
  file: File;
  previewUrl: string;
};

// Claude downsizes larger images anyway, so shrinking them here keeps
// uploads small without losing legibility.
const MAX_IMAGE_EDGE_PX = 1568;
// Same limit as the recipe form, which uploads the cover image on save.
const MAX_COVER_IMAGE_BYTES = 5 * 1024 * 1024;

const downscaleImage = async (file: File): Promise<File> => {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_EDGE_PX / Math.max(bitmap.width, bitmap.height));

    if (scale === 1 && file.size < 1024 * 1024) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );

    return blob ? new File([blob], "screenshot.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
};

export function RecipeAiImport({ onBack, onDraftReady }: RecipeAiImportProps) {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [pdf, setPdf] = useState<File | null>(null);
  const [coverImage, setCoverImage] = useState<AttachedImage | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const imagesRef = useRef<AttachedImage[]>([]);
  const coverImageRef = useRef<AttachedImage | null>(null);
  // The browser back gesture can leave this page while a request is running.
  const isMountedRef = useRef(true);

  imagesRef.current = images;
  coverImageRef.current = coverImage;

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      imagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));

      if (coverImageRef.current) {
        URL.revokeObjectURL(coverImageRef.current.previewUrl);
      }
    };
  }, []);

  const resetInputs = () => {
    images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setImages([]);
    setPdf(null);
    // The cover image is handed to the recipe form, which keeps using its file
    // but makes its own preview URL.
    if (coverImage) {
      URL.revokeObjectURL(coverImage.previewUrl);
    }
    setCoverImage(null);
    setText("");
    setUrl("");
  };

  const handleCoverImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Keine gültige Bilddatei");
      return;
    }

    if (file.size > MAX_COVER_IMAGE_BYTES) {
      toast.error("Bild ist größer als 5 MB");
      return;
    }

    setCoverImage((current) => {
      if (current) {
        URL.revokeObjectURL(current.previewUrl);
      }

      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      };
    });
  };

  const handleRemoveCoverImage = () => {
    setCoverImage((current) => {
      if (current) {
        URL.revokeObjectURL(current.previewUrl);
      }

      return null;
    });
  };

  const handlePdfChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Nur PDF-Dateien");
      return;
    }

    if (file.size > RECIPE_EXTRACT_MAX_PDF_BYTES) {
      toast.error("PDF darf höchstens 4 MB groß sein");
      return;
    }

    setPdf(file);
  };

  const addImageFiles = async (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    if (imageFiles.length === 0) {
      return;
    }

    const freeSlots = RECIPE_EXTRACT_MAX_IMAGES - imagesRef.current.length;

    if (imageFiles.length > freeSlots) {
      toast.error(`Maximal ${RECIPE_EXTRACT_MAX_IMAGES} Bilder erlaubt`);
    }

    const nextImages: AttachedImage[] = [];

    for (const file of imageFiles.slice(0, Math.max(0, freeSlots))) {
      const scaledFile = await downscaleImage(file);

      if (scaledFile.size > RECIPE_EXTRACT_MAX_IMAGE_BYTES) {
        toast.error("Bilder dürfen höchstens 5 MB groß sein");
        continue;
      }

      nextImages.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file: scaledFile,
        previewUrl: URL.createObjectURL(scaledFile),
      });
    }

    setImages((currentImages) => [...currentImages, ...nextImages]);
  };

  const handlePaste = (event: React.ClipboardEvent) => {
    const pastedFiles = Array.from(event.clipboardData.files);

    if (pastedFiles.some((file) => file.type.startsWith("image/"))) {
      // Keep pasted text (if any) but don't insert the image as text.
      if (!event.clipboardData.getData("text")) {
        event.preventDefault();
      }

      void addImageFiles(pastedFiles);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void addImageFiles(files);
  };

  const handleRemoveImage = (imageId: string) => {
    setImages((currentImages) => {
      const removedImage = currentImages.find((image) => image.id === imageId);

      if (removedImage) {
        URL.revokeObjectURL(removedImage.previewUrl);
      }

      return currentImages.filter((image) => image.id !== imageId);
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!text.trim() && !url.trim() && images.length === 0 && !pdf) {
      toast.error(
        coverImage
          ? "Das Rezeptbild wird nicht ausgelesen – Text, Screenshot, PDF oder Link fehlt"
          : "Text, Bild, PDF oder Link fehlt",
      );
      return;
    }

    setIsExtracting(true);

    try {
      const body = new FormData();
      body.append("text", text);
      body.append("url", url);
      images.forEach((image) => body.append("images", image.file));

      if (pdf) {
        body.append("pdf", pdf);
      }

      const response = await fetch("/api/recipes/extract", { method: "POST", body });
      const result = (await response.json().catch(() => null)) as
        | { draft?: RecipeDraft; error?: string }
        | null;

      if (!isMountedRef.current) {
        return;
      }

      if (!response.ok || !result?.draft) {
        toast.error(result?.error || "Kein Rezept erkannt");
        return;
      }

      const pickedCoverImage = coverImage?.file;
      resetInputs();
      onDraftReady(result.draft, pickedCoverImage);
    } catch {
      toast.error("Kein Rezept erkannt");
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <SubPage
      title="KI-Import"
      description="Screenshot, Foto, PDF, Text oder Link einfügen."
      onBack={onBack}
      backDisabled={isExtracting}
      onPaste={handlePaste}
      footer={
        <Button type="submit" form={FORM_ID} className="w-full" disabled={isExtracting}>
          {isExtracting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Erkenne …
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Erkennen
            </>
          )}
        </Button>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Rezeptbild (optional)</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => coverInputRef.current?.click()}
              disabled={isExtracting}
            >
              <ImagePlus className="h-4 w-4" />
              {coverImage ? "Ändern" : "Bild wählen"}
            </Button>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverImageChange}
            />
          </div>

          {coverImage ? (
            <div className="relative overflow-hidden rounded-xl border border-brand-card-border bg-brand-chip-neutral">
              <img
                src={coverImage.previewUrl}
                alt="Rezeptbild"
                className="h-40 w-full object-cover"
              />
              <button
                type="button"
                onClick={handleRemoveCoverImage}
                disabled={isExtracting}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white"
                aria-label="Rezeptbild entfernen"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <p className="text-xs text-brand-tertiary">
              Wird als Bild des Rezepts gespeichert, nicht von der KI gelesen.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-import-text">Text</Label>
          <Textarea
            id="ai-import-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Rezepttext oder Screenshot einfügen …"
            className="h-32"
            disabled={isExtracting}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>
              Zum Auslesen ({images.length}/{RECIPE_EXTRACT_MAX_IMAGES})
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isExtracting || images.length >= RECIPE_EXTRACT_MAX_IMAGES}
            >
              <ImagePlus className="h-4 w-4" />
              Foto
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {images.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {images.map((image) => (
                <div
                  key={image.id}
                  className="relative overflow-hidden rounded-lg border border-brand-card-border bg-brand-chip-neutral"
                >
                  <img
                    src={image.previewUrl}
                    alt="Angehängtes Bild"
                    className="h-20 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(image.id)}
                    disabled={isExtracting}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                    aria-label="Bild entfernen"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-brand-tertiary">
              Screenshots oder Fotos vom Rezept. Mehrere Bilder ergeben ein Rezept.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>PDF (optional)</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => pdfInputRef.current?.click()}
              disabled={isExtracting}
            >
              <FileText className="h-4 w-4" />
              {pdf ? "Ändern" : "PDF wählen"}
            </Button>
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handlePdfChange}
            />
          </div>

          {pdf ? (
            <div className="flex items-center gap-2 rounded-lg border border-brand-card-border bg-brand-chip-neutral px-3 py-2 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-brand-tertiary" />
              <span className="min-w-0 flex-1 truncate" title={pdf.name}>
                {pdf.name}
              </span>
              <button
                type="button"
                onClick={() => setPdf(null)}
                disabled={isExtracting}
                className="rounded-full p-0.5 hover:bg-black/5"
                aria-label="PDF entfernen"
              >
                <X className="h-3.5 w-3.5 text-brand-tertiary" />
              </button>
            </div>
          ) : (
            <p className="text-xs text-brand-tertiary">Max. 4 MB</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-import-url">Link (optional)</Label>
          <Input
            id="ai-import-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            disabled={isExtracting}
          />
        </div>
      </form>
    </SubPage>
  );
}
