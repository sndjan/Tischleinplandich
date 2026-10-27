import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { partialParse } from '@anthropic-ai/sdk/_vendor/partial-json-parser/parser';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  RECIPE_EXTRACT_IMAGE_TYPES,
  RECIPE_EXTRACT_MAX_IMAGE_BYTES,
  RECIPE_EXTRACT_MAX_IMAGES,
  RECIPE_EXTRACT_MAX_PDF_BYTES,
  type RecipeStreamEvent,
} from '@/lib/recipe-draft';
import {
  anthropic,
  consumeAiQuota,
  countPdfPages,
  ExtractedRecipeSchema,
  fetchRecipePage,
  getUserTagNames,
  IDEA_SYSTEM_PROMPT,
  IMPORT_SYSTEM_PROMPT,
  MAX_PDF_PAGES,
  RECIPE_AI_EFFORT,
  RECIPE_AI_MODEL,
  toErrorResponseBody,
  toRecipeDraft,
  UserFacingError,
  type ExtractedRecipe,
} from '@/lib/server/recipe-ai';

type ImageMediaType = (typeof RECIPE_EXTRACT_IMAGE_TYPES)[number];

// Partial results are sent at most this often while the recipe is written.
const PARTIAL_INTERVAL_MS = 150;

/**
 * Reads a recipe from text, links, images and PDFs ("import"), or writes a new one
 * from an idea ("idea"). Responds with newline-delimited JSON events so the app
 * can show the recipe while it is being written.
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  }

  let input: Awaited<ReturnType<typeof readInput>>;

  try {
    input = await readInput(request);
    await consumeAiQuota(supabase);
  } catch (error) {
    const { status, message } = toErrorResponseBody(error);
    return NextResponse.json({ error: message }, { status });
  }

  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: RecipeStreamEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      try {
        let pageContent: string | null = null;

        if (input.url) {
          const host = safeHost(input.url);
          send({ type: 'step', id: 'link', status: 'active', label: `Link wird gelesen · ${host}` });

          try {
            pageContent = await fetchRecipePage(input.url);
            send({ type: 'step', id: 'link', status: 'done', label: `Link gelesen · ${host}` });
          } catch (error) {
            // Sites like Instagram often block page reads; the photos and text
            // that came with the link may still hold the whole recipe.
            if (!input.text && input.imageBlocks.length === 0 && !input.pdfBlock) throw error;
            send({ type: 'step', id: 'link', status: 'done', label: `${host} nicht lesbar · nutze Bilder und Text` });
          }
        }

        const tagNames = await getUserTagNames(supabase, user.id);
        const messages = buildMessages(input, pageContent, tagNames);

        const stream = anthropic.messages.stream(
          {
            model: RECIPE_AI_MODEL,
            max_tokens: 16000,
            system: input.mode === 'idea' ? IDEA_SYSTEM_PROMPT : IMPORT_SYSTEM_PROMPT,
            messages,
            output_config: {
              effort: RECIPE_AI_EFFORT,
              format: zodOutputFormat(ExtractedRecipeSchema),
            },
          },
          { signal: request.signal },
        );

        let json = '';
        let lastPartialAt = 0;

        stream.on('text', (delta) => {
          json += delta;
          const now = Date.now();
          if (now - lastPartialAt < PARTIAL_INTERVAL_MS) return;
          lastPartialAt = now;

          const partial = safePartialParse(json);
          if (partial) {
            send({
              type: 'partial',
              stage: getStage(partial),
              draft: toRecipeDraft(partial, input.url),
            });
          }
        });

        const response = await stream.finalMessage();

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

        const coverIndex = extracted.cover_image_index;

        send({
          type: 'done',
          draft: toRecipeDraft(extracted, input.url),
          coverImageIndex:
            coverIndex !== null && Number.isInteger(coverIndex) && coverIndex >= 0 && coverIndex < input.images.length
              ? coverIndex
              : null,
        });
      } catch (error) {
        if (request.signal.aborted || error instanceof Anthropic.APIUserAbortError) {
          controller.close();
          return;
        }

        send({ type: 'error', message: toErrorResponseBody(error).message });
      }

      controller.close();
    },
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

async function readInput(request: Request) {
  const formData = await request.formData();
  const mode = formData.get('mode') === 'idea' ? ('idea' as const) : ('import' as const);
  const text = String(formData.get('text') ?? '').trim();
  const url = mode === 'import' ? String(formData.get('url') ?? '').trim() : '';
  const preferences = formData.getAll('preferences').map(String).filter(Boolean).slice(0, 10);
  const servings = Math.min(Math.max(Number(formData.get('servings')) || 0, 0), 20);
  const targetHint = String(formData.get('targetHint') ?? '').trim().slice(0, 200);
  const images =
    mode === 'import'
      ? formData.getAll('images').filter((entry): entry is File => entry instanceof File)
      : [];
  const pdfEntry = mode === 'import' ? formData.get('pdf') : null;
  const pdf = pdfEntry instanceof File && pdfEntry.size > 0 ? pdfEntry : null;

  if (mode === 'idea' && !text && preferences.length === 0) {
    throw new UserFacingError('Beschreibe kurz, was du kochen möchtest', 400);
  }

  if (mode === 'import' && !text && !url && images.length === 0 && !pdf) {
    throw new UserFacingError('Text, Bild, PDF oder Link fehlt', 400);
  }

  if (text.length > 20_000) {
    throw new UserFacingError('Text ist zu lang', 400);
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

  let pdfBlock: Anthropic.DocumentBlockParam | null = null;

  if (pdf) {
    if (pdf.type !== 'application/pdf') {
      throw new UserFacingError('Nur PDF-Dateien', 400);
    }

    if (pdf.size > RECIPE_EXTRACT_MAX_PDF_BYTES) {
      throw new UserFacingError('PDF darf höchstens 4 MB groß sein', 400);
    }

    const bytes = Buffer.from(await pdf.arrayBuffer());

    if (countPdfPages(bytes) > MAX_PDF_PAGES) {
      throw new UserFacingError(`PDF darf höchstens ${MAX_PDF_PAGES} Seiten haben`, 400);
    }

    pdfBlock = {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: bytes.toString('base64') },
    };
  }

  return { mode, text, url, preferences, servings, targetHint, images, imageBlocks, pdfBlock };
}

function buildMessages(
  input: Awaited<ReturnType<typeof readInput>>,
  pageContent: string | null,
  tagNames: string[],
): Anthropic.MessageParam[] {
  const tagsText = [
    '<vorhandene_tags>',
    tagNames.length > 0 ? tagNames.join(', ') : '(keine)',
    '</vorhandene_tags>',
  ].join('\n');

  if (input.mode === 'idea') {
    const contextText = [
      tagsText,
      input.text ? `<idee>\n${input.text}\n</idee>` : '',
      input.preferences.length > 0 ? `<wünsche>${input.preferences.join(', ')}</wünsche>` : '',
      input.servings ? `<portionen>${input.servings}</portionen>` : '',
      input.targetHint
        ? `<ziel>Eine Portion soll grob hierzu passen: ${input.targetHint}</ziel>`
        : '',
      'Schreibe ein passendes Rezept.',
    ]
      .filter(Boolean)
      .join('\n\n');

    return [{ role: 'user', content: contextText }];
  }

  const contextText = [
    tagsText,
    input.imageBlocks.length > 0 ? `Es sind ${input.imageBlocks.length} Bilder angehängt (Index 0 bis ${input.imageBlocks.length - 1}).` : '',
    pageContent
      ? `<webseite url="${input.url}">\n${pageContent}\n</webseite>`
      : input.url
        ? `Quelle (Seite nicht lesbar): ${input.url}`
        : '',
    input.text ? `<nutzereingabe>\n${input.text}\n</nutzereingabe>` : '',
    'Extrahiere das Rezept aus den Bildern, Dokumenten und Texten oben.',
  ]
    .filter(Boolean)
    .join('\n\n');

  return [
    {
      role: 'user',
      content: [
        ...(input.pdfBlock ? [input.pdfBlock] : []),
        ...input.imageBlocks,
        { type: 'text', text: contextText },
      ],
    },
  ];
}

function safePartialParse(json: string): Partial<ExtractedRecipe> | null {
  try {
    const parsed = partialParse(json);
    return parsed && typeof parsed === 'object' ? (parsed as Partial<ExtractedRecipe>) : null;
  } catch {
    return null;
  }
}

function getStage(partial: Partial<ExtractedRecipe>) {
  if ('calories' in partial) return 'nutrition' as const;
  if ('preparation_steps' in partial) return 'steps' as const;
  if ('ingredients' in partial) return 'ingredients' as const;
  return 'reading' as const;
}

function safeHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
