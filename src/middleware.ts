import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';

/**
 * Refreshes the Supabase session before any page or route handler runs.
 *
 * Server Components can read cookies but not write them. Without this, a page that
 * found an expired access token refreshed it on the server, which rotates the refresh
 * token, and then dropped the new cookies. The browser kept the used refresh token,
 * and when it tried it too late Supabase treated it as stolen and revoked the session,
 * so devices that had been idle for a while were signed out.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // The request copy lets the page rendered next see the new session, the
          // response copy stores it in the browser.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser refreshes an expired session; nothing may run between it and the client setup.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Everything except static files, so a session is not refreshed for every asset.
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icon|apple-icon|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|js)$).*)',
  ],
};
