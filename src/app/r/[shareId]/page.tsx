import type { Metadata } from 'next';
import { cache } from 'react';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { SharedRecipe } from '@/lib/recipe-sharing';
import { PublicRecipe } from './public-recipe';
import { withSafeLinks } from '@/lib/safe-links';

type PageProps = { params: { shareId: string } };

// Called by both the page and its metadata; cached so it runs once per request.
const loadSharedRecipe = cache(async (shareId: string) => {
  if (!/^[A-Za-z0-9_-]{8,32}$/.test(shareId)) return null;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('get_shared_recipe', { p_share_id: shareId });

  if (error) {
    console.error('get_shared_recipe failed', error.message);
    return null;
  }

  const recipe = data as unknown as SharedRecipe | null;
  return recipe ? withSafeLinks(recipe) : null;
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { shareId } = params;
  const recipe = await loadSharedRecipe(shareId);

  if (!recipe) return { title: 'Rezept nicht gefunden', robots: { index: false } };

  const description = [
    recipe.author_name && `Geteilt von ${recipe.author_name}`,
    recipe.prep_time,
    recipe.calories != null && `${Math.round(recipe.calories)} kcal pro Portion`,
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    title: recipe.name,
    description,
    // Shared links are private-ish: reachable by link, not by search engines.
    robots: { index: false, follow: false },
    openGraph: {
      title: recipe.name,
      description,
      images: recipe.image_url ? [{ url: recipe.image_url }] : undefined,
    },
  };
}

export default async function SharedRecipePage({ params }: PageProps) {
  const { shareId } = params;
  const [recipe, supabase] = await Promise.all([loadSharedRecipe(shareId), createServerSupabaseClient()]);

  if (!recipe) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-brand-app-bg px-8 text-center">
        <span className="text-5xl" aria-hidden="true">🍽️</span>
        <h1 className="font-heading text-2xl font-extrabold text-brand-ink">Dieser Link funktioniert nicht mehr</h1>
        <p className="text-[15px] text-brand-secondary">Vielleicht wurde das Teilen beendet. Frag nach einem neuen Link.</p>
        <Link href="/" className="mt-3 font-bold text-brand-accent-dark">
          Zu Tischleinplandich
        </Link>
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <PublicRecipe recipe={recipe} shareId={shareId} signedIn={Boolean(user)} />;
}
