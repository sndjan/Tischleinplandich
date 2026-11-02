"use client";

import { useRef } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

// Cloudflare Turnstile. Without a site key the captcha is off and forms work as before.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

// How long a send waits for the invisible check before giving up. It usually
// takes a second or two, so this only runs out when the script is blocked.
const WAIT_MS = 15_000;

/**
 * Bot check for forms that send mails. The widget usually stays invisible and
 * only shows a checkbox when Cloudflare is unsure. Each token works only once,
 * so `getToken()` hands it out and starts a fresh check for the next send.
 */
export function useCaptcha() {
  const ref = useRef<TurnstileInstance>(null);
  const token = useRef<string | null>(null);
  // Set when Cloudflare refuses the widget, e.g. 110200 for a hostname missing
  // from the widget's list, or when the script itself does not load.
  const failure = useRef<string | null>(null);
  const enabled = Boolean(TURNSTILE_SITE_KEY);

  const widget = enabled ? (
    <Turnstile
      ref={ref}
      siteKey={TURNSTILE_SITE_KEY}
      onSuccess={(value) => {
        token.current = value;
        failure.current = null;
      }}
      onExpire={() => (token.current = null)}
      onError={(code) => {
        token.current = null;
        failure.current = code || "unknown";
      }}
      onUnsupported={() => (failure.current = "unsupported")}
      scriptOptions={{ onError: () => (failure.current = "script") }}
      options={{ appearance: "interaction-only", language: "de", size: "flexible", theme: "light" }}
    />
  ) : null;

  /** Waits for the check if it is still running; throws with a German message if it fails. */
  const getToken = async (): Promise<string | undefined> => {
    if (!enabled) return undefined;
    let value = token.current;
    if (!value && !failure.current && ref.current) {
      value = await ref.current.getResponsePromise(WAIT_MS).catch(() => null);
    }
    if (!value) throw new Error(captchaFailureMessage(failure.current));
    token.current = null;
    ref.current?.reset();
    return value;
  };

  return { enabled, widget, getToken };
}

function captchaFailureMessage(code: string | null) {
  if (code === null || code === "script") {
    return "Die Sicherheitsprüfung von Cloudflare lädt nicht. Blockiert ein Werbe- oder Trackingblocker challenges.cloudflare.com? Lade die Seite neu oder versuch es in einem anderen Browser.";
  }
  return `Die Sicherheitsprüfung hat nicht geklappt (Fehler ${code}). Lade die Seite neu oder versuch es in einem anderen Browser.`;
}
