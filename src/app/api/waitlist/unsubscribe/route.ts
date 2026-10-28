import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { readWaitlistToken } from '../token';

/**
 * Removes the email from the waitlist entirely (withdrawing consent).
 */
export async function POST(request: Request) {
  const token = await readWaitlistToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Ungültiger Link' }, { status: 400 });
  }

  const { error } = await createAdminSupabaseClient().from('waitlist').delete().eq('token', token);
  if (error) {
    console.error('Waitlist unsubscribe failed', error);
    return NextResponse.json({ error: 'Das hat nicht geklappt' }, { status: 500 });
  }

  // Unknown tokens count as success too: the address is off the list either way.
  return NextResponse.json({ ok: true });
}
