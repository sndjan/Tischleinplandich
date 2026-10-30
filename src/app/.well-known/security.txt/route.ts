import { OPERATOR } from "@/lib/legal";
import { SITE_URL } from "@/lib/site";

// Built once per deploy, so Expires (required by RFC 9116) moves forward with
// every release instead of going stale in a hand-written file.
export const dynamic = "force-static";

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export function GET() {
  const body = [
    `Contact: mailto:${OPERATOR.email}`,
    `Expires: ${new Date(Date.now() + ONE_YEAR_MS).toISOString()}`,
    "Preferred-Languages: de, en",
    `Canonical: ${SITE_URL}/.well-known/security.txt`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
