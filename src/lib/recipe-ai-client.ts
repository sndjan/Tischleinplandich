"use client";

import type { RecipeDraft, RecipeRefineResult, RecipeStreamEvent } from "@/lib/recipe-draft";

const readError = async (response: Response) => {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error || "Das hat nicht geklappt, bitte erneut versuchen";
};

/**
 * Sends an import or idea request and reports each streamed event.
 * Resolves with the final event, rejects with a user-facing message.
 */
export async function streamRecipe(
  body: FormData,
  onEvent: (event: RecipeStreamEvent) => void,
  signal: AbortSignal,
): Promise<Extract<RecipeStreamEvent, { type: "done" }>> {
  const response = await fetch("/api/recipes/extract", { method: "POST", body, signal });

  if (!response.ok || !response.body) {
    throw new Error(await readError(response));
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;

      const event = JSON.parse(line) as RecipeStreamEvent;

      if (event.type === "error") throw new Error(event.message);
      if (event.type === "done") return event;
      onEvent(event);
    }
  }

  throw new Error("Antwort unvollständig, bitte erneut versuchen");
}

export async function refineRecipe(
  draft: RecipeDraft,
  instruction: string,
): Promise<RecipeRefineResult> {
  const response = await fetch("/api/recipes/refine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draft, instruction }),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as RecipeRefineResult;
}
