"use client";

import { RECIPE_IMAGE_MAX_BYTES, RECIPE_IMAGE_TYPES } from "@/lib/recipe-images";

// Claude downsizes larger images anyway, so shrinking them here keeps uploads
// small (and the request cheap) without losing legibility.
const MAX_IMAGE_EDGE_PX = 1568;

export async function downscaleImage(file: File): Promise<File> {
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

    return blob ? new File([blob], "foto.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export type AttachedImage = {
  id: string;
  file: File;
  previewUrl: string;
};

export const createAttachedImage = (file: File): AttachedImage => ({
  id: crypto.randomUUID(),
  file,
  previewUrl: URL.createObjectURL(file),
});

// Covers are shown at most a few hundred pixels tall, so this is plenty.
const MAX_COVER_EDGE_PX = 2000;

/**
 * A cover photo the storage bucket accepts: JPEG, PNG or WebP up to 5 MB.
 * Anything else (GIFs from recipe pages, huge photos) is redrawn as a JPEG.
 * Resolves null when the browser can't read the image at all.
 */
export async function toUploadableImage(file: File): Promise<File | null> {
  if (RECIPE_IMAGE_TYPES.includes(file.type) && file.size <= RECIPE_IMAGE_MAX_BYTES) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_COVER_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob && blob.size <= RECIPE_IMAGE_MAX_BYTES ? new File([blob], "titelbild.jpg", { type: "image/jpeg" }) : null;
  } catch {
    return null;
  }
}
