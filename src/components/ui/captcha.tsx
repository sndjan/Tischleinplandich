"use client";

import { useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

// Cloudflare Turnstile. Without a site key the captcha is off and forms work as before.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/**
 * Bot check for forms that send mails. The widget usually stays invisible and
 * only shows a checkbox when Cloudflare is unsure. Each token works only once,
 * so `take()` hands it out and starts a fresh check for the next send.
 */
export function useCaptcha() {
  const ref = useRef<TurnstileInstance>(null);
  const [token, setToken] = useState<string | null>(null);
  const enabled = Boolean(TURNSTILE_SITE_KEY);

  const widget = enabled ? (
    <Turnstile
      ref={ref}
      siteKey={TURNSTILE_SITE_KEY}
      onSuccess={setToken}
      onExpire={() => setToken(null)}
      onError={() => setToken(null)}
      options={{ appearance: "interaction-only", language: "de", size: "flexible", theme: "light" }}
    />
  ) : null;

  const take = () => {
    const current = token ?? undefined;
    setToken(null);
    ref.current?.reset();
    return current;
  };

  return { enabled, ready: !enabled || token !== null, widget, take };
}

export const CAPTCHA_PENDING_MESSAGE = "Sicherheitsprüfung läuft noch – bitte gleich nochmal versuchen.";
