"use client";

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
