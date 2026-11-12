// Limits where scripts, frames and requests may come from, as a second line of
// defence should markup ever get injected. Next.js needs inline scripts without
// nonces (those would rule out static pages), so the gain is mostly that nothing
// loads from or talks to a foreign host, and that nothing can frame the app.
function contentSecurityPolicy() {
  const turnstile = "https://challenges.cloudflare.com";
  let supabase = "";
  let supabaseRealtime = "";
  try {
    const { host } = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    supabase = `https://${host}`;
    supabaseRealtime = `wss://${host}`;
  } catch {
    // Not configured (yet): the app can't reach Supabase either way.
  }
  // React's dev tooling evaluates code; production never does.
  const devEval = process.env.NODE_ENV === "production" ? "" : "'unsafe-eval'";

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' ${devEval} ${turnstile}`,
    "style-src 'self' 'unsafe-inline'",
    // blob: and data: are photos picked on the device before they are uploaded.
    `img-src 'self' data: blob: ${supabase}`,
    "font-src 'self' data:",
    `connect-src 'self' data: blob: ${supabase} ${supabaseRealtime} ${turnstile}`,
    `frame-src 'self' ${turnstile}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ]
    .map((directive) => directive.replace(/\s+/g, " ").trim())
    .join("; ");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Baked into the client and /api/version alike, so an open app can tell a
  // newer deploy apart from the one it is running.
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now()),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=(), payment=(), usb=()" },
        ],
      },
      {
        // Let browsers pick up service worker updates immediately.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
};

module.exports = nextConfig;
