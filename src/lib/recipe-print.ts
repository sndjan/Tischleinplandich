import type { Recipe } from "@/types/database";

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

const splitLines = (text: string | null) =>
  (text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

// Only web links may become an href or src; anything else stays plain text.
const isWebUrl = (url: string | null): url is string => !!url && /^https?:\/\//i.test(url);

function recipeSection(recipe: Recipe, tags: string[]) {
  const steps = splitLines(recipe.preparation_steps).map((line) => line.replace(/^\d+[.)](?!\d)\s*/, ""));
  const facts = [
    `${recipe.serving_size || 1} ${recipe.serving_size === 1 ? "Portion" : "Portionen"}`,
    recipe.prep_time,
    recipe.calories != null ? `${recipe.calories} kcal` : null,
    recipe.protein != null ? `${recipe.protein} g Protein` : null,
    recipe.rating ? "★".repeat(recipe.rating) + "☆".repeat(5 - recipe.rating) : null,
  ].filter(Boolean) as string[];

  return `<section class="recipe">
  <h1>${escapeHtml(recipe.name)}</h1>
  <p class="facts">${facts.map(escapeHtml).join(" · ")}</p>
  ${tags.length > 0 ? `<p class="tags">${tags.map(escapeHtml).join(" · ")}</p>` : ""}
  ${isWebUrl(recipe.image_url) ? `<img src="${escapeHtml(recipe.image_url)}" alt="">` : ""}
  <div class="columns">
    <div>
      <h2>Zutaten</h2>
      <ul>${splitLines(recipe.ingredients).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
    </div>
    ${steps.length > 0 ? `<div><h2>Zubereitung</h2><ol>${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol></div>` : ""}
  </div>
  ${isWebUrl(recipe.source_url) ? `<p class="source">Quelle: ${escapeHtml(recipe.source_url)}</p>` : ""}
</section>`;
}

/**
 * All recipes as one printable page, one recipe per sheet. The browser's print
 * dialog turns it into a PDF, so no PDF library ships with the app.
 */
export function recipesToPrintHtml(recipes: Recipe[], tagsById: Record<string, string[]>): string {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Meine Rezepte</title>
<style>
  @page { margin: 16mm; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #1c2b22; font-size: 11pt; line-height: 1.45; margin: 0; }
  .recipe { break-after: page; }
  .recipe:last-child { break-after: auto; }
  h1 { font-size: 20pt; margin: 0 0 4pt; }
  h2 { font-size: 12pt; margin: 14pt 0 6pt; color: #2f7a52; }
  .facts, .tags, .source { color: #5b6b61; margin: 0 0 4pt; }
  .source { margin-top: 12pt; font-size: 9pt; word-break: break-all; }
  img { width: 100%; max-height: 80mm; object-fit: cover; border-radius: 8pt; margin: 8pt 0; }
  .columns { display: grid; grid-template-columns: 1fr 2fr; gap: 18pt; }
  ul, ol { margin: 0; padding-left: 16pt; }
  li { margin-bottom: 3pt; break-inside: avoid; }
</style>
</head>
<body>
${recipes.map((recipe) => recipeSection(recipe, tagsById[recipe.id] ?? [])).join("\n")}
</body>
</html>`;
}
