"use client";

import type { Recipe } from "@/types/database";

/**
 * All recipes as Markdown files in a ZIP (one file per recipe, photos in
 * images/), so they stay usable without the app, e.g. in Obsidian or Notion.
 */
export async function exportRecipesAsZip(
  recipes: Recipe[],
  tagsById: Record<string, string[]>,
): Promise<Blob> {
  const encoder = new TextEncoder();
  const files: ZipEntry[] = [];
  const usedNames = new Set<string>();

  for (const recipe of recipes) {
    const slug = uniqueSlug(recipe.name, usedNames);
    const image = recipe.image_url ? await downloadImage(recipe.image_url) : null;
    const imagePath = image ? `images/${slug}.${image.extension}` : null;

    if (image && imagePath) files.push({ name: imagePath, data: image.data });
    files.push({
      name: `${slug}.md`,
      data: encoder.encode(recipeToMarkdown(recipe, tagsById[recipe.id] ?? [], imagePath)),
    });
  }

  return new Blob([buildZip(files)], { type: "application/zip" });
}

export function recipeToMarkdown(recipe: Recipe, tags: string[], imagePath: string | null) {
  const steps = (recipe.preparation_steps ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^\d+[.)](?!\d)\s*/, ""))
    .filter(Boolean);
  const ingredients = recipe.ingredients
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  // JSON strings are valid YAML, so names with colons or quotes stay intact.
  const frontMatter = [
    "---",
    `title: ${JSON.stringify(recipe.name)}`,
    `servings: ${recipe.serving_size || 1}`,
    recipe.prep_time ? `prep_time: ${JSON.stringify(recipe.prep_time)}` : null,
    tags.length > 0 ? `tags: [${tags.map((tag) => JSON.stringify(tag)).join(", ")}]` : null,
    recipe.rating ? `rating: ${recipe.rating}` : null,
    recipe.source_url ? `source: ${JSON.stringify(recipe.source_url)}` : null,
    `created: ${recipe.created_at.slice(0, 10)}`,
    "---",
  ].filter(Boolean);

  const nutrition = [
    ["kcal", recipe.calories, ""],
    ["Protein", recipe.protein, " g"],
    ["Kohlenhydrate", recipe.carbs, " g"],
    ["Fett", recipe.fats, " g"],
  ].filter(([, value]) => value !== null) as Array<[string, number, string]>;

  const facts = [
    `**Portionen:** ${recipe.serving_size || 1}`,
    recipe.prep_time ? `**Zeit:** ${recipe.prep_time}` : null,
    recipe.rating ? `**Bewertung:** ${"★".repeat(recipe.rating)}${"☆".repeat(5 - recipe.rating)}` : null,
  ].filter(Boolean);

  return [
    ...frontMatter,
    "",
    `# ${recipe.name}`,
    "",
    imagePath ? `![${recipe.name}](${imagePath})\n` : null,
    facts.join(" · "),
    "",
    nutrition.length > 0
      ? [
          "## Nährwerte pro Portion",
          "",
          `| ${nutrition.map(([label]) => label).join(" | ")} |`,
          `| ${nutrition.map(() => "---").join(" | ")} |`,
          `| ${nutrition.map(([, value, unit]) => `${value}${unit}`).join(" | ")} |`,
          "",
        ].join("\n")
      : null,
    "## Zutaten",
    "",
    ...ingredients.map((line) => `- ${line}`),
    "",
    steps.length > 0 ? ["## Zubereitung", "", ...steps.map((step, index) => `${index + 1}. ${step}`), ""].join("\n") : null,
    recipe.source_url ? `Quelle: <${recipe.source_url}>\n` : null,
  ]
    .filter((part) => part !== null)
    .join("\n");
}

function uniqueSlug(name: string, used: Set<string>) {
  const base =
    name
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "rezept";

  let slug = base;
  for (let counter = 2; used.has(slug); counter += 1) slug = `${base}-${counter}`;
  used.add(slug);
  return slug;
}

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

// A missing photo should never stop the export; the recipe just has none.
async function downloadImage(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const type = response.headers.get("content-type")?.split(";")[0] ?? "";
    const extension = IMAGE_EXTENSIONS[type] ?? url.match(/\.(jpe?g|png|webp|gif)(?:\?|$)/i)?.[1]?.toLowerCase();
    if (!extension) return null;
    return { data: new Uint8Array(await response.arrayBuffer()), extension };
  } catch {
    return null;
  }
}

type ZipEntry = { name: string; data: Uint8Array };

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Minimal ZIP archive without compression ("stored"). Photos are already
 * compressed and the Markdown is small, so compression would gain little.
 */
export function buildZip(entries: ZipEntry[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0x0800, true); // UTF-8 file names
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    localParts.push(new Uint8Array(local.buffer), name, entry.data);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true); // version made by
    central.setUint16(6, 20, true);
    central.setUint16(8, 0x0800, true);
    central.setUint16(10, 0, true);
    central.setUint16(12, dosTime, true);
    central.setUint16(14, dosDate, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, size, true);
    central.setUint32(24, size, true);
    central.setUint16(28, name.length, true);
    central.setUint32(42, offset, true);
    centralParts.push(new Uint8Array(central.buffer), name);

    offset += 30 + name.length + size;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  const parts = [...localParts, ...centralParts, new Uint8Array(end.buffer)];
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let position = 0;
  for (const part of parts) {
    result.set(part, position);
    position += part.length;
  }
  return result;
}
