import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod/v4';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  RECIPE_EXTRACT_IMAGE_TYPES,
  RECIPE_EXTRACT_MAX_IMAGE_BYTES,
  RECIPE_EXTRACT_MAX_IMAGES,
  RECIPE_EXTRACT_MAX_PDF_BYTES,
  type RecipeDraft,
} from '@/lib/recipe-draft';

const MODEL = 'claude-haiku-5-5';
const URL_FETCH_TIMEOUT_MS = 10_000;
const MAX_PAGE_BYTES = 3 * 1024 * 1024;
// Page text beyond this is almost always comments, footers and ads.
const MAX_PAGE_TEXT_CHARS = 60_000;

type ImageMediaType = (typeof RECIPE_EXTRACT_IMAGE_TYPES)[number];

const ExtractedRecipeSchema = z.object({
  recipe_found: z.boolean(),
  name: z.string(),
  ingredients: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().nullable(),
      unit: z.string().nullable(),
    }),
  ),
  preparation_steps: z.array(z.string()),
  prep_time: z.string().nullable(),
  serving_size: z.number(),
  calories: z.number().nullable(),
  protein: z.number().nullable(),
  carbs: z.number().nullable(),
  fats: z.number().nullable(),
  tags: z.array(z.string()),
  source_url: z.string().nullable(),
});

const SYSTEM_PROMPT = `Du extrahierst Kochrezepte aus Screenshots, Fotos, PDFs, kopiertem Text und Webseiten für eine Wochen-Essensplaner-App.

Alle Eingaben des Nutzers gehören zu EINEM Rezept (z. B. Zutaten auf einem Screenshot, Zubereitung auf einem anderen, plus eine Notiz). Führe sie zusammen. Enthält die Eingabe mehrere verschiedene Rezepte, nimm nur das erste. Enthält sie gar kein Rezept, setze recipe_found auf false und lasse die übrigen Felder leer bzw. null.

Regeln:
- Schreibe Name, Zutaten, Zubereitungsschritte und Tags auf Deutsch, auch wenn die Quelle eine andere Sprache hat.
- Rechne Mengen in metrische Einheiten um (g, kg, ml, l). Übliche Küchenmaße wie EL, TL, Prise, Stück, Bund, Dose bleiben erhalten. Ohne Mengenangabe ist quantity null.
- preparation_steps: ein Schritt pro Eintrag, ohne Nummerierung.
- serving_size: Anzahl der Portionen, die das Rezept ergibt (Standard 1).
- Nährwerte (calories in kcal, protein/carbs/fats in g) gelten PRO PORTION. Stehen sie in der Quelle, übernimm sie (ggf. auf eine Portion umgerechnet). Fehlen sie, schätze sie realistisch anhand der Zutaten und Mengen.
- prep_time als kurzer Text, z. B. "30 Min." oder null.
- tags: 1–4 kurze Tags (z. B. Mahlzeit, Küche, Eigenschaften). Verwende bevorzugt die vorhandenen Tags des Nutzers, wenn sie passen.
- source_url: die Webseiten-URL, falls eine angegeben wurde, sonst null.`;

const anthropic = new Anthropic();

class UserFacingError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const text = String(formData.get('text') ?? '').trim();
    const url = String(formData.get('url') ?? '').trim();
    const images = formData.getAll('images').filter((entry): entry is File => entry instanceof File);
    const pdfEntry = formData.get('pdf');
    const pdf = pdfEntry instanceof File && pdfEntry.size > 0 ? pdfEntry : null;

    if (!text && !url && images.length === 0 && !pdf) {
      throw new UserFacingError('Text, Bild, PDF oder Link fehlt', 400);
    }

    if (images.length > RECIPE_EXTRACT_MAX_IMAGES) {
      throw new UserFacingError(`Maximal ${RECIPE_EXTRACT_MAX_IMAGES} Bilder erlaubt`, 400);
    }

    const imageBlocks: Anthropic.ImageBlockParam[] = [];

    for (const image of images) {
      if (!RECIPE_EXTRACT_IMAGE_TYPES.includes(image.type as ImageMediaType)) {
        throw new UserFacingError('Nur JPG, PNG, GIF oder WEBP', 400);
      }

      if (image.size > RECIPE_EXTRACT_MAX_IMAGE_BYTES) {
        throw new UserFacingError('Bilder dürfen höchstens 5 MB groß sein', 400);
      }

      imageBlocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: image.type as ImageMediaType,
          data: Buffer.from(await image.arrayBuffer()).toString('base64'),
        },
      });
    }

    const documentBlocks: Anthropic.DocumentBlockParam[] = [];

    if (pdf) {
      if (pdf.type !== 'application/pdf') {
        throw new UserFacingError('Nur PDF-Dateien', 400);
      }

      if (pdf.size > RECIPE_EXTRACT_MAX_PDF_BYTES) {
        throw new UserFacingError('PDF darf höchstens 4 MB groß sein', 400);
      }

      documentBlocks.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: Buffer.from(await pdf.arrayBuffer()).toString('base64'),
        },
      });
    }

    const [pageContent, tagsResult] = await Promise.all([
      url ? fetchRecipePage(url) : Promise.resolve(null),
      supabase.from('tags').select('name').eq('user_id', user.id).order('name'),
    ]);

    if (tagsResult.error) throw tagsResult.error;

    const tagNames = ((tagsResult.data ?? []) as Array<{ name: string }>).map((tag) => tag.name);

    const contextText = [
      '<vorhandene_tags>',
      tagNames.length > 0 ? tagNames.join(', ') : '(keine)',
      '</vorhandene_tags>',
      pageContent ? `<webseite url="${url}">\n${pageContent}\n</webseite>` : '',
      text ? `<nutzereingabe>\n${text}\n</nutzereingabe>` : '',
      'Extrahiere das Rezept aus den Bildern, Dokumenten und Texten oben.',
    ]
      .filter(Boolean)
      .join('\n\n');

    const response = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [...documentBlocks, ...imageBlocks, { type: 'text', text: contextText }],
        },
      ],
      output_config: {
        effort: 'medium',
        format: zodOutputFormat(ExtractedRecipeSchema),
      },
    });

    if (response.stop_reason === 'refusal') {
      throw new UserFacingError('Anfrage abgelehnt', 422);
    }

    if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
      throw new UserFacingError('Antwort unvollständig, bitte erneut versuchen', 502);
    }

    const extracted = response.parsed_output;

    if (!extracted.recipe_found || !extracted.name.trim()) {
      throw new UserFacingError('Kein Rezept erkannt', 422);
    }

    const draft = toRecipeDraft(extracted, url);
    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof UserFacingError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Recipe extraction failed', error);

    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: 'Zu viele Anfragen, bitte kurz warten' },
        { status: 429 },
      );
    }

    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: 'Claude-API-Schlüssel fehlt oder ist ungültig (ANTHROPIC_API_KEY)' },
        { status: 500 },
      );
    }

    return NextResponse.json({ error: 'Kein Rezept erkannt' }, { status: 500 });
  }
}

function toRecipeDraft(
  extracted: z.infer<typeof ExtractedRecipeSchema>,
  requestUrl: string,
): RecipeDraft {
  const ingredientLines = extracted.ingredients
    .map((ingredient) =>
      [ingredient.quantity?.toString() ?? '', ingredient.unit?.trim() ?? '', ingredient.name.trim()]
        .filter((part) => part.length > 0)
        .join(' '),
    )
    .filter(Boolean);

  const roundOrNull = (value: number | null) => (value === null ? null : Math.round(value));

  return {
    name: extracted.name.trim(),
    ingredients: ingredientLines.join('\n'),
    preparation_steps: extracted.preparation_steps
      .map((step) => step.trim())
      .filter(Boolean)
      .map((step, index) => `${index + 1}. ${step}`)
      .join('\n'),
    source_url: extracted.source_url?.trim() || requestUrl,
    prep_time: extracted.prep_time?.trim() ?? '',
    tags: extracted.tags.map((tag) => tag.trim()).filter(Boolean),
    calories: roundOrNull(extracted.calories),
    protein: roundOrNull(extracted.protein),
    carbs: roundOrNull(extracted.carbs),
    fats: roundOrNull(extracted.fats),
    serving_size: extracted.serving_size > 0 ? extracted.serving_size : 1,
  };
}

async function fetchRecipePage(rawUrl: string): Promise<string> {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new UserFacingError('Ungültige URL', 400);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UserFacingError('Nur http- und https-Links', 400);
  }

  let html: string;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WeeklyMealPlanner/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(URL_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentLength = Number(response.headers.get('content-length') ?? 0);

    if (contentLength > MAX_PAGE_BYTES) {
      throw new Error('Page too large');
    }

    html = await response.text();
  } catch (error) {
    console.error('Recipe page fetch failed', error);
    throw new UserFacingError(
      'Webseite nicht erreichbar – nutze Text oder Screenshot',
      422,
    );
  }

  // Most recipe sites embed a schema.org Recipe as JSON-LD, which is far
  // cleaner than the page text.
  const jsonLdBlocks = Array.from(
    html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
    (match) => match[1].trim(),
  ).filter((block) => /"@type"\s*:\s*(\[[^\]]*)?"Recipe"/.test(block));

  if (jsonLdBlocks.length > 0) {
    return jsonLdBlocks.join('\n');
  }

  const pageText = html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|li|h\d|div|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();

  if (!pageText) {
    throw new UserFacingError('Kein Text auf der Webseite', 422);
  }

  return pageText.slice(0, MAX_PAGE_TEXT_CHARS);
}
