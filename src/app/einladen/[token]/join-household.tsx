'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { CACHE_STORAGE_KEY } from '@/lib/query-provider';
import { formatMemberNames, householdErrorMessage, MAX_HOUSEHOLD_MEMBERS, MAX_SHARED_HOUSEHOLDS } from '@/lib/households';

// Returned by preview_household_invite (migration 030).
export type InvitePreview = {
  household_id: string;
  name: string | null;
  member_names: (string | null)[];
  member_count: number;
  is_member: boolean;
  needs_display_name: boolean;
  at_household_limit: boolean;
};

const openApp = () => {
  // The app's cached data still shows the previous household; start fresh.
  try {
    window.localStorage.removeItem(CACHE_STORAGE_KEY);
  } catch {
    // No cache to clear.
  }
  window.location.assign('/meal-planner');
};

export function JoinHousehold({ token, preview }: { token: string; preview: InvitePreview }) {
  const [name, setName] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const householdName = preview.name || 'Haushalt';
  const full = preview.member_count >= MAX_HOUSEHOLD_MEMBERS;
  const blocked = !preview.is_member && (preview.at_household_limit || full);

  const join = async () => {
    if (joining) return;
    setJoining(true);
    setError(null);

    const supabase = createClient();
    try {
      if (preview.needs_display_name && !preview.is_member) {
        const displayName = name.trim().slice(0, 40);
        if (!displayName) {
          setError('Gib dir zuerst einen Namen, damit die anderen wissen, wer du bist.');
          return;
        }
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const { error: nameError } = await supabase
          .from('users')
          .update({ display_name: displayName })
          .eq('id', session?.user.id ?? '');
        if (nameError) throw nameError;
      }

      const { error: joinError } = await supabase.rpc('join_household', { p_token: token });
      if (joinError) {
        setError(householdErrorMessage(joinError));
        return;
      }
      openApp();
    } catch (caught) {
      console.error(caught);
      setError(householdErrorMessage(caught));
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-brand-app-bg px-5 py-10">
      <div className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 text-center ring-1 ring-brand-card-border">
        <span className="mx-auto flex size-16 items-center justify-center rounded-[20px] bg-brand-accent-bg text-3xl" aria-hidden="true">
          🏠
        </span>
        <div className="space-y-1">
          <p className="text-[13px] font-bold uppercase tracking-wide text-brand-secondary">Einladung</p>
          <h1 className="font-heading text-2xl font-extrabold text-brand-ink">{householdName}</h1>
          <p className="flex items-center justify-center gap-1.5 text-[15px] text-brand-secondary">
            <Users className="size-4" />
            {formatMemberNames(preview.member_names)}
          </p>
        </div>

        {preview.is_member ? (
          <>
            <p className="text-[15px] text-brand-secondary">Du bist schon dabei.</p>
            <button
              type="button"
              onClick={() => void join()}
              className="flex h-12 w-full items-center justify-center rounded-full bg-brand-accent-dark font-bold text-white"
            >
              In „{householdName}“ planen
            </button>
          </>
        ) : blocked ? (
          <>
            <p className="text-[15px] text-brand-secondary">
              {full
                ? `Der Haushalt ist voll (höchstens ${MAX_HOUSEHOLD_MEMBERS} Leute).`
                : `Du bist schon in ${MAX_SHARED_HOUSEHOLDS} gemeinsamen Haushalten. Verlass zuerst einen (Profil → Haushalt).`}
            </p>
            <Link href="/meal-planner" className="block font-bold text-brand-accent-dark">
              Zur App
            </Link>
          </>
        ) : (
          <>
            <p className="text-[15px] leading-relaxed text-brand-secondary">
              Ihr plant dieselbe Woche und könnt eure Rezepte gegenseitig einplanen. Die anderen sehen deinen Namen und
              deine Rezepte, aber nicht deine Bewertungen.
            </p>
            {preview.needs_display_name && (
              <input
                value={name}
                maxLength={40}
                onChange={(event) => setName(event.target.value)}
                placeholder="Dein Name"
                aria-label="Dein Name"
                autoComplete="given-name"
                className="h-12 w-full rounded-xl bg-brand-chip-neutral px-4 text-[15px] text-brand-ink outline-none placeholder:text-brand-muted focus:ring-2 focus:ring-brand-accent"
              />
            )}
            <button
              type="button"
              disabled={joining}
              onClick={() => void join()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-accent-dark font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              {joining && <Loader2 className="size-4 animate-spin" />}
              Beitreten
            </button>
            <Link href="/meal-planner" className="block text-[13px] font-bold text-brand-secondary">
              Nicht jetzt
            </Link>
          </>
        )}

        {error && (
          <p role="alert" className="text-sm font-semibold text-brand-red">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
