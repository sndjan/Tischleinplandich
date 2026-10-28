export const RECIPE_IMAGE_BUCKET = 'recipe-images';

// Mirrors the bucket's own limits (migration 016), which Storage enforces.
export const RECIPE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const RECIPE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const STORAGE_PUBLIC_MARKER = `/storage/v1/object/public/${RECIPE_IMAGE_BUCKET}/`;

const sanitizeFileName = (fileName: string) => {
  const lastDotIndex = fileName.lastIndexOf('.');
  const baseName = lastDotIndex > 0 ? fileName.slice(0, lastDotIndex) : fileName;
  const extension = lastDotIndex > 0 ? fileName.slice(lastDotIndex).toLowerCase() : '';
  const normalizedBaseName = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return `${normalizedBaseName || 'recipe-image'}${extension}`;
};

export const createRecipeImagePath = (userId: string, fileName: string) => {
  return `${userId}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
};

export const getRecipeImagePathFromUrl = (imageUrl: string | null) => {
  if (!imageUrl) {
    return null;
  }

  try {
    const url = new URL(imageUrl);
    const markerIndex = url.pathname.indexOf(STORAGE_PUBLIC_MARKER);

    if (markerIndex === -1) {
      return null;
    }

    return decodeURIComponent(url.pathname.slice(markerIndex + STORAGE_PUBLIC_MARKER.length));
  } catch {
    return null;
  }
};