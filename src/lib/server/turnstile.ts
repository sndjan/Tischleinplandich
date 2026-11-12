import "server-only";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Checks a Cloudflare Turnstile token. Without either Turnstile key the captcha
 * is off and every request passes, so forms keep working before it is set up.
 */
export async function verifyTurnstile(token: string | undefined, remoteIp: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // A site key without its secret is a half-finished setup, not "captcha
    // off": the forms show the widget, so nothing may pass unchecked.
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
      console.error("TURNSTILE_SECRET_KEY is missing although NEXT_PUBLIC_TURNSTILE_SITE_KEY is set");
      return false;
    }
    return true;
  }
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetch(SITEVERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(5_000) });
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch (error) {
    console.error("Turnstile check failed", error);
    return false;
  }
}
