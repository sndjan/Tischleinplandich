"use client";

import { useState } from "react";
import Link from "next/link";
import type { WaitlistAction as Action } from "@/lib/waitlist";

const COPY: Record<Action, { intro: string; button: string; done: string }> = {
  confirm: {
    intro: "Ein Klick noch, dann bist du auf der Warteliste und erfährst als Erstes, wenn es losgeht.",
    button: "Anmeldung bestätigen",
    done: "Danke! Du bist auf der Warteliste. Bis dahin kannst du die Beta schon kostenlos nutzen.",
  },
  unsubscribe: {
    intro: "Deine E-Mail-Adresse wird von der Warteliste gelöscht. Wir schreiben dir danach nicht mehr.",
    button: "Von der Warteliste abmelden",
    done: "Erledigt. Deine E-Mail-Adresse ist gelöscht.",
  },
};

/**
 * Confirms or removes a waitlist entry only on a button press, so mail scanners
 * that open links on their own don't do it for the recipient.
 */
export function WaitlistAction({ token, action }: { token: string; action: Action }) {
  const [state, setState] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const copy = COPY[action];

  const submit = async () => {
    setState("pending");
    try {
      const response = await fetch(`/api/waitlist/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Das hat nicht geklappt");
      setState("done");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Das hat nicht geklappt");
      setState("error");
    }
  };

  if (!token) return <p>Dieser Link ist unvollständig. Bitte öffne ihn direkt aus der Mail.</p>;

  if (state === "done") {
    return (
      <>
        <p>{copy.done}</p>
        <p>
          <Link href="/">Zur Startseite</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <p>{copy.intro}</p>
      <button
        type="button"
        disabled={state === "pending"}
        onClick={() => void submit()}
        className="mt-2 rounded-full bg-brand-accent-dark px-7 py-4 text-[17px] font-bold text-white transition-colors hover:bg-brand-ink disabled:opacity-60"
      >
        {state === "pending" ? "Einen Moment …" : copy.button}
      </button>
      {state === "error" && (
        <p role="alert" className="font-medium text-brand-red">
          {error}
        </p>
      )}
    </>
  );
}
