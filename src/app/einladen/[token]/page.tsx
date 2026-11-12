import type { Metadata } from 'next';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isInviteToken } from '@/lib/households';
import { JoinHousehold, type InvitePreview } from './join-household';

type PageProps = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: 'Einladung',
  // Invite links are secret; keep them out of search engines.
  robots: { index: false, follow: false },
};

function Message({ emoji, title, text, href, linkLabel }: { emoji: string; title: string; text: string; href: string; linkLabel: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-brand-app-bg px-8 text-center">
      <span className="text-5xl" aria-hidden="true">
        {emoji}
      </span>
      <h1 className="font-heading text-2xl font-extrabold text-brand-ink">{title}</h1>
      <p className="max-w-sm text-[15px] text-brand-secondary">{text}</p>
      <Link href={href} className="mt-3 font-bold text-brand-accent-dark">
        {linkLabel}
      </Link>
    </div>
  );
}

/**
 * Target of a household invite link. Visitors sign in first and come back here;
 * the household's name is only shown to signed-in people.
 */
export default async function InvitePage({ params }: PageProps) {
  const { token } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Message
        emoji="🏠"
        title="Du bist eingeladen"
        text="Jemand möchte mit dir gemeinsam Mahlzeiten planen. Melde dich an oder leg ein Konto an, dann kannst du beitreten."
        href={`/auth/signin?next=${encodeURIComponent(`/einladen/${token}`)}`}
        linkLabel="Anmelden und beitreten"
      />
    );
  }

  const { data, error } = isInviteToken(token)
    ? await supabase.rpc('preview_household_invite', { p_token: token })
    : { data: null, error: null };

  if (error) console.error('preview_household_invite failed', error.message);

  const preview = data as InvitePreview | null;

  if (!preview) {
    return (
      <Message
        emoji="🔗"
        title="Dieser Link funktioniert nicht mehr"
        text="Einladungen gelten 7 Tage und werden ungültig, wenn jemand den Link zurücksetzt. Frag nach einem neuen."
        href="/meal-planner"
        linkLabel="Zur App"
      />
    );
  }

  return <JoinHousehold token={token} preview={preview} />;
}
