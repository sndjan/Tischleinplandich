'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, Plus } from 'lucide-react';
import { saveSharedRecipeCopy, type SharedRecipe } from '@/lib/recipe-sharing';
import { RecipeBody } from '@/components/meal-planner/recipe-body';
import { SharedByLine } from '@/components/meal-planner/shared-recipe-screen';
import { cn } from '@/lib/utils';
import { LegalLinks } from '@/components/legal/legal-links';
import { OPERATOR } from '@/lib/legal';

/**
 * A shared recipe for anyone with the link. Signed-in users can save a copy;
 * everyone else is invited to sign in first and comes back here afterwards.
 */
export function PublicRecipe({
  recipe,
  shareId,
  signedIn,
}: {
  recipe: SharedRecipe;
  shareId: string;
  signedIn: boolean;
}) {
  const [servings, setServings] = useState(recipe.serving_size > 0 ? recipe.serving_size : 1);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const signInHref = `/auth/signin?next=${encodeURIComponent(`/r/${shareId}`)}`;

  const save = async () => {
    setState('saving');
    try {
      await saveSharedRecipeCopy(recipe);
      setState('saved');
    } catch (error) {
      console.error(error);
      setState('error');
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <div className="sticky top-0 z-40 flex h-11 items-center justify-between border-b border-brand-card-border bg-white/90 px-3.5 pt-[env(safe-area-inset-top)] backdrop-blur">
        <Link href="/" className="flex items-center gap-1.5 font-heading text-base font-extrabold text-brand-ink">
          <span aria-hidden="true">🥗</span> Tischleinplandich
        </Link>
        {signedIn ? (
          <Link href="/meal-planner" className="text-[13px] font-bold text-brand-accent-dark">
            Zur App
          </Link>
        ) : (
          <Link href={signInHref} className="text-[13px] font-bold text-brand-accent-dark">
            Anmelden
          </Link>
        )}
      </div>

      <div className="mx-auto w-full max-w-2xl flex-1">
        <RecipeBody
          recipe={recipe}
          tags={recipe.tags}
          servings={servings}
          onServingsChange={setServings}
          attribution={<SharedByLine name={recipe.author_name} />}
        />
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 px-4 pb-6 text-[13px] text-brand-secondary">
          <LegalLinks />
          {/* Notice path for illegal or infringing content (Art. 16 DSA). */}
          <a
            href={`mailto:${OPERATOR.email}?subject=${encodeURIComponent(`Rezept melden: /r/${shareId}`)}`}
            className="hover:text-brand-ink"
          >
            Rezept melden
          </a>
        </div>
      </div>

      <footer className="sticky bottom-0 z-30 border-t border-brand-card-border bg-white shadow-[0_-6px_16px_rgba(28,43,34,0.06)]">
        <div className="mx-auto w-full max-w-2xl space-y-2 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {signedIn ? (
            state === 'saved' ? (
              <Link
                href="/meal-planner"
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-brand-accent-bg text-base font-bold text-brand-accent-dark"
              >
                <Check className="size-[18px] animate-pop-in" strokeWidth={3} />
                Gespeichert · Zur App
              </Link>
            ) : (
              <>
                {state === 'error' && (
                  <p className="text-center text-sm font-medium text-brand-red">Speichern fehlgeschlagen</p>
                )}
                <button
                  type="button"
                  disabled={state === 'saving'}
                  onClick={() => void save()}
                  className={cn(
                    'flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-brand-accent-dark text-base font-bold text-white transition-transform active:scale-[0.97]',
                    state === 'saving' && 'opacity-85',
                  )}
                >
                  {state === 'saving' ? (
                    <Loader2 className="size-[18px] animate-spin" />
                  ) : (
                    <Plus className="size-[18px]" strokeWidth={2.6} />
                  )}
                  In meine Rezepte speichern
                </button>
              </>
            )
          ) : (
            <>
              <p className="text-center text-[13px] text-brand-secondary">Plane deine Woche mit Rezepten wie diesem.</p>
              <Link
                href={signInHref}
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-brand-accent-dark text-base font-bold text-white transition-transform active:scale-[0.97]"
              >
                <Plus className="size-[18px]" strokeWidth={2.6} />
                In meine Rezepte speichern
              </Link>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
