'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Returns the signed-in user from the locally stored session.
 *
 * Use this instead of `supabase.auth.getUser()` in client components: getUser holds
 * the auth storage lock for a network round trip, so several components calling it on
 * mount queue past gotrue's lock timeout and the lock gets forcibly stolen, aborting
 * in-flight calls. Server pages already verify the user and RLS enforces access.
 */
export async function getSessionUser() {
  const {
    data: { session },
  } = await createClient().auth.getSession();
  return session?.user ?? null;
}
