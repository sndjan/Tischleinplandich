'use client';

import { createBrowserClient } from '@supabase/ssr';
import {
  navigatorLock,
  NavigatorLockAcquireTimeoutError,
} from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const LOCK_NOT_AVAILABLE = Symbol('lock-not-available');

/**
 * gotrue's default navigatorLock, except a zero-timeout attempt that finds the lock
 * busy throws outside the LockManager callback. gotrue catches that error (it just
 * skips an auto-refresh tick), but when it is thrown inside the callback Firefox still
 * logs it as "Uncaught (in promise)".
 */
async function authLock<R>(
  name: string,
  acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> {
  if (acquireTimeout !== 0 || !globalThis.navigator?.locks) {
    return navigatorLock(name, acquireTimeout, fn);
  }
  const result = await globalThis.navigator.locks.request(
    name,
    { mode: 'exclusive', ifAvailable: true },
    async (lock) => (lock ? fn() : LOCK_NOT_AVAILABLE),
  );
  if (result === LOCK_NOT_AVAILABLE) {
    throw new NavigatorLockAcquireTimeoutError(
      `Acquiring an exclusive Navigator LockManager lock "${name}" immediately failed`,
    );
  }
  return result as R;
}

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { lock: authLock } }
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
