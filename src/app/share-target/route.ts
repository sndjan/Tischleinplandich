import { NextResponse } from 'next/server';

/**
 * Fallback for shares that arrive before the service worker is active: the link
 * and text are passed on in the URL (shared files need the service worker).
 */
export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const target = new URL('/meal-planner', request.url);
  target.searchParams.set('shared', '1');

  for (const key of ['title', 'text', 'url']) {
    const value = String(formData?.get(key) ?? '').slice(0, 2000);
    if (value) target.searchParams.set(key, value);
  }

  return NextResponse.redirect(target, 303);
}
