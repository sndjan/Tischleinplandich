// Ingredients are stored as text, one per line. A line starting with "#" names
// the group of the lines below it ("# Für die Soße"), so groups survive in every
// place that only knows the text: shopping list, export, editor, sharing.

const HEADER_PATTERN = /^#+\s*/;

export const isIngredientHeader = (line: string) => HEADER_PATTERN.test(line.trim());

export const ingredientHeaderName = (line: string) => line.trim().replace(HEADER_PATTERN, "").trim();

export const formatIngredientHeader = (name: string) => `# ${name.trim()}`;

export type IngredientLine = {
  line: string;
  // Name of the group the line belongs to, null before the first header.
  group: string | null;
};

/**
 * The ingredient lines of a recipe without group headers, each with its group.
 * Indices into this list are what recipe details refer to.
 */
export function ingredientLines(text: string | null | undefined): IngredientLine[] {
  const lines: IngredientLine[] = [];
  let group: string | null = null;

  for (const raw of (text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (isIngredientHeader(line)) {
      group = ingredientHeaderName(line) || null;
      continue;
    }
    lines.push({ line, group });
  }

  return lines;
}
