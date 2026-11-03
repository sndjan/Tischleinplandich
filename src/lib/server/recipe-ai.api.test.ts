import { describe, expect, it } from "vitest";

// Sends each AI output schema to the real API with a tiny request, because the
// API also rejects schemas whose compiled grammar is too large, and that limit
// isn't published. Costs a fraction of a cent; skipped unless asked for:
//   CHECK_AI_SCHEMAS=1 ANTHROPIC_API_KEY=... npx vitest run src/lib/server/recipe-ai.api.test.ts
const enabled = process.env.CHECK_AI_SCHEMAS === "1" && Boolean(process.env.ANTHROPIC_API_KEY);

describe.skipIf(!enabled)("AI output schemas against the API", async () => {
  const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");
  const ai = await import("@/lib/server/recipe-ai");

  const schemas = {
    extract: ai.ExtractedRecipeSchema,
    refine: ai.RefinedRecipeSchema,
    recalculate: ai.RecalculatedRecipeSchema,
  };

  for (const [name, schema] of Object.entries(schemas)) {
    it(`accepts the ${name} schema`, { timeout: 200_000 }, async () => {
      const response = await ai.anthropic.messages.create({
        model: ai.RECIPE_AI_MODEL,
        max_tokens: 64,
        messages: [{ role: "user", content: "Kein Rezept, nur ein Test." }],
        output_config: { effort: ai.RECIPE_AI_EFFORT, format: zodOutputFormat(schema) },
      });
      expect(response.id).toBeTruthy();
    });
  }
});
