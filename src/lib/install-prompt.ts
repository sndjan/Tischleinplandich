"use client";

// Chrome's install prompt fires once, early, often before the profile screen is
// open, so it is kept here until the user taps "App installieren".
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: InstallPromptEvent | null = null;

export function captureInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
  });
}

export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/**
 * Shows the browser's install dialog when there is one. Returns false where the
 * browser has none (iOS Safari), so the caller can explain the manual way.
 */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  const prompt = deferredPrompt;
  deferredPrompt = null;
  await prompt.prompt();
  await prompt.userChoice;
  return true;
}
