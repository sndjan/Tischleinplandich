import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { readWaitlistToken } from '../token';

/**
 * Confirms a waitlist sign-up (the second step of the double opt-in). A POST from
 * the page behind the mail link, so mail scanners opening the link don't confirm.
 */
export async function POST(request: Request) {
  const token = await readWaitlistToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Ungültiger Link' }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const { data: entry, error } = await admin
    .from('waitlist')
    .select('id, confirmed_at')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    console.error('Waitlist confirm failed', error);
    return NextResponse.json({ error: 'Das hat nicht geklappt' }, { status: 500 });
  }
  if (!entry) {
    return NextResponse.json({ error: 'Link abgelaufen oder ungültig' }, { status: 404 });
  }

  if (!entry.confirmed_at) {
    const { error: updateError } = await admin
      .from('waitlist')
      .update({ confirmed_at: new Date().toISOString() })
      .eq('id', entry.id);
    if (updateError) {
      console.error('Waitlist confirm failed', updateError);
      return NextResponse.json({ error: 'Das hat nicht geklappt' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
