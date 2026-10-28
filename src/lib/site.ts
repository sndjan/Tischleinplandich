// Public address of the site, for canonical URLs, the sitemap and social previews.
// Set NEXT_PUBLIC_SITE_URL in production (e.g. https://essensplaner.de).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const SITE_NAME = "Essensplaner";
