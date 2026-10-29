"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

/**
 * An installed app can stay open for days and keep running an old version. When
 * a newer deploy is live it offers to reload, checked whenever the app comes back
 * to the foreground and every half hour while it is open.
 */
export function UpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const current = process.env.NEXT_PUBLIC_BUILD_ID;
    if (process.env.NODE_ENV !== "production" || !current) return;

    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/version", { cache: "no-store" });
        if (!response.ok) return;
        const { buildId } = (await response.json()) as { buildId: string | null };
        if (buildId && buildId !== current) setUpdateAvailable(true);
      } catch {
        // Offline; try again next time.
      }
    };

    const timer = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-[calc(0.5rem+env(safe-area-inset-top))] z-[45] flex justify-center px-4 animate-pop-up"
    >
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="flex h-11 items-center gap-2 rounded-full bg-brand-ink pl-4 pr-1.5 text-sm font-semibold text-white shadow-lg transition-transform active:scale-[0.97]"
      >
        Neue Version verfügbar
        <span className="flex h-8 items-center gap-1.5 rounded-full bg-white/15 px-3 font-bold text-[#9fe0b7]">
          <RefreshCw className="size-3.5" strokeWidth={2.5} />
          Aktualisieren
        </span>
      </button>
    </div>
  );
}
