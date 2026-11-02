import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { RecipeDraft } from '@/lib/recipe-draft';
import { mergeRecalculated } from '@/lib/recipe-recalculate';
import {
  anthropic,
  consumeAiQuota,
  draftForRefine,
  RECALCULATE_SYSTEM_PROMPT,
  RecalculatedRecipeSchema,
  RECIPE_AI_EFFORT,
  RECIPE_AI_MODEL,
  toErrorResponseBody,
  toRecipeDraft,
  UserFacingError,
} from '@/lib/server/recipe-ai';

/**
 * Recomputes nutrition, the "Ausgewogenheit" facts and the details of a recipe
 * after the user edited it. Works on the recipe as it is now, not on its source,
 * and keeps the user's text.
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
    const body = (await request.json().catch(() => null)) as { draft?: RecipeDraft } | null;
    const draft = body?.draft;

    if (!draft || typeof draft.ingredients !== 'string' || !draft.ingredients.trim()) {
      throw new UserFacingError('Das Rezept braucht mindestens eine Zutat', 400);
    }

    const recipeJson = JSON.stringify(draftForRefine(draft));

    if (recipeJson.length > 30_000) {
      throw new UserFacingError('Rezept ist zu lang zum Berechnen', 400);
    }

    await consumeAiQuota(supabase);

    const response = await anthropic.messages.parse({
      model: RECIPE_AI_MODEL,
      max_tokens: 16000,
      system: RECALCULATE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `<rezept>\n${recipeJson}\n</rezept>` }],
      output_config: {
        effort: RECIPE_AI_EFFORT,
        format: zodOutputFormat(RecalculatedRecipeSchema),
      },
    });

    if (response.stop_reason === 'refusal') {
      throw new UserFacingError('Anfrage abgelehnt', 422);
    }

    if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
      throw new UserFacingError('Antwort unvollständig, bitte erneut versuchen', 502);
    }

    const computed = toRecipeDraft(response.parsed_output, draft.source_url, null);
    return NextResponse.json({ draft: mergeRecalculated(draft, computed) });
  } catch (error) {
    const { status, message } = toErrorResponseBody(error);
    return NextResponse.json({ error: message }, { status });
  }
}
