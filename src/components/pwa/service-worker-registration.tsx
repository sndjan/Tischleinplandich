"use client";

import { useEffect } from "react";
import { captureInstallPrompt } from "@/lib/install-prompt";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    captureInstallPrompt();
  }, []);

  useEffect(() => {
    // Skipped in dev: dev chunks aren't content-hashed, so caching them would serve stale code.
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed", error);
    });
  }, []);

  return null;
}
