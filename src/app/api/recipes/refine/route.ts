import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { RecipeDraft, RecipeRefineResult } from '@/lib/recipe-draft';
import {
  anthropic,
  consumeAiQuota,
  RECIPE_AI_EFFORT,
  RECIPE_AI_MODEL,
  REFINE_SYSTEM_PROMPT,
  RefinedRecipeSchema,
  toErrorResponseBody,
  toRecipeDraft,
  UserFacingError,
} from '@/lib/server/recipe-ai';

/**
 * Changes a recipe draft by instruction ("für 4 Personen", "vegan", ...).
 * Only the current recipe and the latest instruction are sent, not the chat
 * history, which keeps every change equally cheap.
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => null)) as {
      draft?: RecipeDraft;
      instruction?: string;
    } | null;
    const instruction = body?.instruction?.trim() ?? '';
    const draft = body?.draft;

    if (!draft || !instruction) {
      throw new UserFacingError('Was soll geändert werden?', 400);
    }

    if (instruction.length > 500) {
      throw new UserFacingError('Anweisung ist zu lang', 400);
    }

    const recipeJson = JSON.stringify({
      name: draft.name,
      serving_size: draft.serving_size,
      prep_time: draft.prep_time,
      ingredients: draft.ingredients.split('\n').filter(Boolean),
      preparation_steps: draft.preparation_steps.split('\n').filter(Boolean),
      calories: draft.calories,
      protein: draft.protein,
      carbs: draft.carbs,
      fats: draft.fats,
      tags: draft.tags,
    });

    if (recipeJson.length > 30_000) {
      throw new UserFacingError('Rezept ist zu lang für Änderungen', 400);
    }

    await consumeAiQuota(supabase);

    const response = await anthropic.messages.parse({
      model: RECIPE_AI_MODEL,
      max_tokens: 16000,
      system: REFINE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `<rezept>\n${recipeJson}\n</rezept>\n\n<anweisung>\n${instruction}\n</anweisung>`,
        },
      ],
      output_config: {
        effort: RECIPE_AI_EFFORT,
        format: zodOutputFormat(RefinedRecipeSchema),
      },
    });

    if (response.stop_reason === 'refusal') {
      throw new UserFacingError('Anfrage abgelehnt', 422);
    }

    if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
      throw new UserFacingError('Antwort unvollständig, bitte erneut versuchen', 502);
    }

    const { recipe, summary, changes } = response.parsed_output;
    const result: RecipeRefineResult = {
      draft: { ...toRecipeDraft(recipe, draft.source_url), source_url: draft.source_url },
      summary: summary.trim(),
      changes: changes.slice(0, 6),
    };

    return NextResponse.json(result);
  } catch (error) {
    const { status, message } = toErrorResponseBody(error);
    return NextResponse.json({ error: message }, { status });
  }
}
