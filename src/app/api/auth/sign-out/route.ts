import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();

  // Only this device; the default (global) would sign out every other device too.
  await supabase.auth.signOut({ scope: 'local' });

  return NextResponse.redirect(new URL('/', request.url), {
    status: 302,
  });
}
