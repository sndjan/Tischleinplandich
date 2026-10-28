import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { sendWaitlistConfirmation } from '@/lib/server/waitlist-mail';
import { WAITLIST_CONSENT_TEXT } from '@/lib/waitlist';

// A repeated sign-up resends the confirmation mail at most this often.
const RESEND_AFTER_MS = 10 * 60 * 1000;
const UNCONFIRMED_DAYS = 30;

const SignUpSchema = z.object({
  email: z.email().max(254),
  // Honeypot: hidden from people, filled in by simple bots.
  website: z.string().optional(),
});

/**
 * Puts an email on the waitlist and sends the double opt-in mail. Always answers
 * the same way, so the form can't be used to find out who is on the list.
 */
export async function POST(request: Request) {
  const parsed = SignUpSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Bitte eine gültige E-Mail eingeben' }, { status: 400 });
  }
  if (parsed.data.website) {
    return NextResponse.json({ ok: true });
  }

  const email = parsed.data.email.trim().toLowerCase();

  try {
    const admin = createAdminSupabaseClient();

    // Unconfirmed sign-ups are kept for 30 days (see Datenschutzerklärung).
    await admin
      .from('waitlist')
      .delete()
      .is('confirmed_at', null)
      .lt('created_at', new Date(Date.now() - UNCONFIRMED_DAYS * 24 * 60 * 60 * 1000).toISOString());

    const { data: existing, error: selectError } = await admin
      .from('waitlist')
      .select('token, confirmed_at, last_mail_sent_at')
      .eq('email', email)
      .maybeSingle();
    if (selectError) throw selectError;

    let token: string;

    if (existing) {
      const sentRecently =
        existing.last_mail_sent_at && Date.now() - Date.parse(existing.last_mail_sent_at) < RESEND_AFTER_MS;
      if (existing.confirmed_at || sentRecently) {
        return NextResponse.json({ ok: true });
      }
      token = existing.token;
    } else {
      const { data: created, error: insertError } = await admin
        .from('waitlist')
        .insert({ email, consent_text: WAITLIST_CONSENT_TEXT })
        .select('token')
        .single();
      if (insertError) throw insertError;
      token = created.token;
    }

    await sendWaitlistConfirmation(email, token);
    await admin.from('waitlist').update({ last_mail_sent_at: new Date().toISOString() }).eq('email', email);
  } catch (error) {
    console.error('Waitlist sign-up failed', error);
    return NextResponse.json({ error: 'Das hat nicht geklappt. Bitte später erneut versuchen.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
