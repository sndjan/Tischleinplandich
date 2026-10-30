import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  ANALYZE_SYSTEM_PROMPT,
  anthropic,
  BalanceFactsSchema,
  consumeAiQuota,
  RECIPE_AI_EFFORT,
  RECIPE_AI_MODEL,
  toErrorResponseBody,
  toRecipeBalance,
  UserFacingError,
} from '@/lib/server/recipe-ai';

/**
 * Estimates the "Ausgewogenheit" facts for one of the user's saved recipes,
 * e.g. one typed by hand or edited since the import, and stores them.
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
    const body = (await request.json().catch(() => null)) as { recipeId?: unknown } | null;
    const recipeId = typeof body?.recipeId === 'string' ? body.recipeId : '';
    if (!recipeId) throw new UserFacingError('Rezept fehlt', 400);

    // Selecting the column first means a missing migration costs no AI request.
    const { data: recipe, error } = await supabase
      .from('recipes')
      .select('id, name, ingredients, preparation_steps, serving_size, balance')
      .eq('id', recipeId)
      .eq('user_id', user.id)
      .maybeSingle();

    // 42703: the balance column from migration 022 is not there yet.
    if (error?.code === '42703') {
      throw new UserFacingError(
        'Ausgewogenheit braucht noch ein kleines Datenbank-Update (supabase/migrations/022_recipe_balance.sql).',
        409,
      );
    }
    if (error) throw error;
    if (!recipe) throw new UserFacingError('Rezept nicht gefunden', 404);
    if (!recipe.ingredients.trim()) throw new UserFacingError('Das Rezept hat noch keine Zutaten', 400);

    await consumeAiQuota(supabase);

    const recipeText = [
      `<name>${recipe.name}</name>`,
      `<portionen>${recipe.serving_size || 1}</portionen>`,
      `<zutaten>\n${recipe.ingredients}\n</zutaten>`,
      recipe.preparation_steps ? `<zubereitung>\n${recipe.preparation_steps.slice(0, 6000)}\n</zubereitung>` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const response = await anthropic.messages.parse({
      model: RECIPE_AI_MODEL,
      max_tokens: 8000,
      system: ANALYZE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `<rezept>\n${recipeText}\n</rezept>` }],
      output_config: {
        effort: RECIPE_AI_EFFORT,
        format: zodOutputFormat(BalanceFactsSchema),
      },
    });

    if (response.stop_reason === 'refusal') {
      throw new UserFacingError('Anfrage abgelehnt', 422);
    }

    const balance =
      response.stop_reason === 'max_tokens'
        ? null
        : toRecipeBalance(response.parsed_output, recipe.ingredients, recipe.serving_size);

    if (!balance) {
      throw new UserFacingError('Antwort unvollständig, bitte erneut versuchen', 502);
    }

    const { error: updateError } = await supabase
      .from('recipes')
      .update({ balance })
      .eq('id', recipe.id)
      .eq('user_id', user.id);

    if (updateError) throw updateError;

    return NextResponse.json({ balance });
  } catch (error) {
    const { status, message } = toErrorResponseBody(error);
    return NextResponse.json({ error: message }, { status });
  }
}
