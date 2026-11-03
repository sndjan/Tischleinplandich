"use client";

// Browser side of club notifications: registers the club's service worker and manages
// this device's Web Push subscription.

const SW_URL = "/verein-sw.js";
const SW_SCOPE = "/verein";

export type PushSupport = "supported" | "ios-needs-install" | "unsupported";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac with touch.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** iPhones only get Web Push in apps added to the home screen (iOS 16.4 and later). */
export function getPushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  if (isIos() && !isStandalone()) return "ios-needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  return "supported";
}

async function getRegistration() {
  const registration = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
  if (registration.active) return registration;

  // pushManager.subscribe needs an active worker; the first install takes a moment.
  const worker = registration.installing ?? registration.waiting;
  await new Promise<void>((resolve) => {
    if (!worker) return resolve();
    worker.addEventListener("statechange", () => {
      if (worker.state === "activated") resolve();
    });
  });
  return registration;
}

function base64UrlToUint8Array(base64Url: string) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function saveSubscription(subscription: PushSubscription) {
  const response = await fetch("/api/verein/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? "Benachrichtigungen konnten nicht aktiviert werden.");
  }
}

/** This device's subscription, re-sent to the server so a cleaned-up entry comes back. */
export async function getCurrentSubscription() {
  if (getPushSupport() !== "supported" || Notification.permission !== "granted") return null;
  const registration = await getRegistration();
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) await saveSubscription(subscription).catch(() => undefined);
  return subscription;
}

export async function subscribeToPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error("Push ist noch nicht eingerichtet (NEXT_PUBLIC_VAPID_PUBLIC_KEY fehlt).");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Benachrichtigungen sind blockiert. Du kannst sie in den Browser-Einstellungen wieder erlauben."
        : "Ohne deine Erlaubnis können wir dich nicht benachrichtigen.",
    );
  }

  const registration = await getRegistration();
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(publicKey),
    }));
  await saveSubscription(subscription);
  return subscription;
}

export async function unsubscribeFromPush(subscription: PushSubscription) {
  await fetch("/api/verein/push", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => undefined);
  await subscription.unsubscribe();
}

export async function sendTestPush(subscription: PushSubscription) {
  const response = await fetch("/api/verein/push/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? "Die Test-Benachrichtigung hat nicht geklappt.");
  }
}
