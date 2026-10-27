import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeNextPath } from '@/lib/auth/next-path';

/**
 * Target of the sign-in link in the email. Handles both link styles:
 * - token_hash: works in any browser (recommended email template, see README)
 * - code: Supabase's default link, only works in the browser that asked for it
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get('next'));
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;

  const supabase = await createServerSupabaseClient();

  const { error } = tokenHash && type
    ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    : code
      ? await supabase.auth.exchangeCodeForSession(code)
      : { error: new Error('Link unvollständig') };

  if (!error) {
    return NextResponse.redirect(new URL(next, url.origin));
  }

  const signIn = new URL('/auth/signin', url.origin);
  signIn.searchParams.set('error', 'link');
  if (next !== '/meal-planner') signIn.searchParams.set('next', next);

  return NextResponse.redirect(signIn);
}
