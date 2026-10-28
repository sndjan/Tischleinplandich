"use client";

import { useEffect, useState } from "react";
import { ROTATING_WORDS } from "./content";

const INTERVAL_MS = 2600;

/**
 * "Essensplanung, die …" with the ending swapping every few seconds. Screen
 * readers and search engines get the whole sentence once instead.
 */
export function RotatingHeadline() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % ROTATING_WORDS.length), INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <h1 className="font-heading text-[clamp(30px,6vw,76px)] font-black leading-[1.08] tracking-[-0.025em] text-brand-ink">
      <span className="sr-only">
        Essensplanung, die Kalorien mitzählt, Rezepte per KI liest, den Einkauf schreibt und dir gehört.
      </span>
      <span aria-hidden="true">
        Essensplanung, die
        <br />
        {/* Very narrow phones wrap the longer endings, so keep room for two lines there. */}
        <span className="inline-block min-h-[2.3em] min-[380px]:min-h-[1.15em]">
          {/* The key remounts the word so its entrance animation plays on every change. */}
          <span
            key={index}
            className="inline-block animate-word-in rounded-[14px] bg-brand-highlight px-3.5 motion-reduce:animate-none"
          >
            {ROTATING_WORDS[index]}
          </span>
        </span>
      </span>
    </h1>
  );
}
