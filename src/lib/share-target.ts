"use client";

// Content shared into the installed app from another app (Instagram, Chrome,
// Photos, ...). The service worker receives the share and parks it in this cache;
// the planner picks it up after the redirect to /meal-planner?shared=1.

export const SHARE_CACHE_NAME = "share-target-v1";
const SHARE_META_URL = "/__share-target/meta";

export type SharedContent = {
  text: string;
  url: string;
  files: File[];
};

const URL_PATTERN = /https?:\/\/[^\s<>"']+/i;

/**
 * Splits the first link out of a text, e.g. an Instagram share "Look at this!
 * https://instagram.com/p/…".
 */
export function splitFirstUrl(text: string): { url: string; rest: string } {
  const match = text.match(URL_PATTERN);
  if (!match) return { url: "", rest: text.trim() };

  return {
    url: match[0].replace(/[).,;!?]+$/, ""),
    rest: text.replace(match[0], " ").replace(/\s+/g, " ").trim(),
  };
}

export async function takeSharedContent(): Promise<SharedContent | null> {
  if (typeof caches === "undefined") return null;

  try {
    const cache = await caches.open(SHARE_CACHE_NAME);
    const metaResponse = await cache.match(SHARE_META_URL);
    if (!metaResponse) return null;

    const meta = (await metaResponse.json()) as {
      title?: string;
      text?: string;
      url?: string;
      files?: Array<{ key: string; name: string; type: string }>;
    };

    const files: File[] = [];
    for (const entry of meta.files ?? []) {
      const fileResponse = await cache.match(entry.key);
      if (fileResponse) {
        files.push(new File([await fileResponse.blob()], entry.name, { type: entry.type }));
      }
    }

    await caches.delete(SHARE_CACHE_NAME);

    // Apps put the link into "url", "text" or both; keep any extra text as a note.
    const combinedText = [meta.title, meta.text].filter(Boolean).join("\n");
    const fromText = splitFirstUrl(combinedText);

    return {
      url: meta.url || fromText.url,
      text: meta.url ? combinedText.replace(meta.url, "").trim() : fromText.rest,
      files,
    };
  } catch (error) {
    console.error("Reading shared content failed", error);
    return null;
  }
}
