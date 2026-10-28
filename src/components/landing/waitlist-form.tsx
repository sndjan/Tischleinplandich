"use client";

import { useState } from "react";
import Link from "next/link";
import { WAITLIST_CONSENT_TEXT } from "@/lib/waitlist";

/**
 * Email field for launch news. The address only counts after the link in the
 * confirmation mail is clicked (double opt-in).
 */
export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "pending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const submit = async () => {
    setState("pending");
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Das hat nicht geklappt");
      setState("sent");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Das hat nicht geklappt");
      setState("error");
    }
  };

  if (state === "sent") {
    return (
      <p role="status" className="mx-auto max-w-[480px] rounded-2xl bg-white px-5 py-4 text-[17px] font-bold text-brand-ink">
        Fast geschafft! Bitte bestätige die Anmeldung über den Link in deinem Postfach.
      </p>
    );
  }

  return (
    <form
      className="mx-auto flex max-w-[480px] flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <label className="sr-only" htmlFor="waitlist-email">
          E-Mail
        </label>
        <input
          id="waitlist-email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="du@beispiel.de"
          className="h-14 w-full min-w-0 rounded-full sm:flex-1 border border-brand-input-border bg-white px-5 text-base text-brand-ink outline-none focus:border-2 focus:border-brand-accent"
        />
        {/* Honeypot for bots; hidden from people and screen readers. */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          className="hidden"
        />
        <button
          type="submit"
          disabled={state === "pending"}
          className="h-14 rounded-full bg-brand-accent-dark px-7 text-[17px] font-bold text-white transition-colors hover:bg-brand-ink disabled:opacity-60"
        >
          {state === "pending" ? "Wird gesendet …" : "Eintragen"}
        </button>
      </div>
      {state === "error" && (
        <p role="alert" className="text-sm font-medium text-brand-red">
          {error}
        </p>
      )}
      <p className="text-[13px] leading-relaxed text-brand-secondary">
        {WAITLIST_CONSENT_TEXT} Mehr in der{" "}
        <Link href="/datenschutz" className="underline hover:text-brand-ink">
          Datenschutzerklärung
        </Link>
        .
      </p>
    </form>
  );
}
