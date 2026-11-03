"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Bell, BellOff, BellRing, Loader2, Share, PlusSquare } from "lucide-react";
import {
  getCurrentSubscription,
  getPushSupport,
  sendTestPush,
  subscribeToPush,
  unsubscribeFromPush,
  type PushSupport,
} from "@/lib/club/push-client";

/**
 * The card at the top that turns on notifications for this device, or explains what is
 * missing (iPhones need the app on the home screen first).
 */
export function NotifyCard() {
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [busy, setBusy] = useState<"subscribe" | "test" | "off" | null>(null);

  useEffect(() => {
    const current = getPushSupport();
    setSupport(current);
    if (current === "supported") {
      getCurrentSubscription()
        .then(setSubscription)
        .catch(() => setSubscription(null));
    }
  }, []);

  if (support === null) {
    return <div className="h-[132px] animate-pulse rounded-3xl bg-white/70" />;
  }

  if (support === "ios-needs-install") {
    return (
      <section className="rounded-3xl bg-[#1f3f8f] p-5 text-white shadow-[0_12px_30px_-12px_rgba(31,63,143,0.6)]">
        <div className="flex items-center gap-2 font-heading text-lg font-extrabold">
          <Bell className="size-5" aria-hidden="true" />
          Benachrichtigungen auf dem iPhone
        </div>
        <p className="mt-2 text-sm leading-relaxed text-white/85">
          Damit du von neuen Einsätzen erfährst, füge die App einmal zum Home-Bildschirm hinzu und öffne sie von dort:
        </p>
        <ol className="mt-3 space-y-2 text-sm">
          <li className="flex items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/15">
              <Share className="size-4" aria-hidden="true" />
            </span>
            Unten in Safari auf <strong>Teilen</strong> tippen
          </li>
          <li className="flex items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/15">
              <PlusSquare className="size-4" aria-hidden="true" />
            </span>
            <span>
              <strong>Zum Home-Bildschirm</strong> wählen, dann die App öffnen
            </span>
          </li>
        </ol>
      </section>
    );
  }

  if (support === "unsupported") {
    return (
      <section className="rounded-3xl border border-[#e3e7ef] bg-white p-5">
        <div className="flex items-center gap-2 font-heading text-lg font-extrabold text-[#16213a]">
          <BellOff className="size-5 text-[#8a94a8]" aria-hidden="true" />
          Keine Benachrichtigungen möglich
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-[#5b6680]">
          Dieser Browser unterstützt keine Push-Benachrichtigungen. Probier es mit Chrome, Edge, Firefox oder Safari.
        </p>
      </section>
    );
  }

  const subscribe = async () => {
    setBusy("subscribe");
    try {
      setSubscription(await subscribeToPush());
      toast.success("Benachrichtigungen sind an");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    if (!subscription) return;
    setBusy("test");
    try {
      await sendTestPush(subscription);
      toast.success("Test verschickt – gleich sollte sie da sein");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const turnOff = async () => {
    if (!subscription) return;
    setBusy("off");
    await unsubscribeFromPush(subscription).catch(() => undefined);
    setSubscription(null);
    setBusy(null);
    toast("Benachrichtigungen sind aus");
  };

  if (subscription) {
    return (
      <section className="flex items-center gap-3 rounded-3xl border border-[#d6e2fb] bg-white p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#e8effd] text-[#2f5fd0]">
          <BellRing className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[#16213a]">Benachrichtigungen an</p>
          <p className="text-sm text-[#5b6680]">Du erfährst sofort von neuen Einsätzen.</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
          <button
            type="button"
            onClick={test}
            disabled={busy !== null}
            className="rounded-full bg-[#e8effd] px-3 py-1.5 text-sm font-semibold text-[#2f5fd0] transition active:scale-95 disabled:opacity-60"
          >
            {busy === "test" ? <Loader2 className="size-4 animate-spin" /> : "Testen"}
          </button>
          <button
            type="button"
            onClick={turnOff}
            disabled={busy !== null}
            className="px-1 text-xs font-medium text-[#8a94a8] hover:text-[#16213a]"
          >
            Ausschalten
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#2f5fd0] to-[#1f3f8f] p-5 text-white shadow-[0_14px_34px_-14px_rgba(31,63,143,0.7)]">
      <div aria-hidden="true" className="absolute -right-8 -top-10 size-36 rounded-full bg-white/10" />
      <div aria-hidden="true" className="absolute -bottom-14 right-10 size-28 rounded-full bg-white/5" />
      <div className="relative">
        <p className="font-heading text-xl font-extrabold">Nichts mehr verpassen</p>
        <p className="mt-1 max-w-sm text-sm leading-relaxed text-white/85">
          Schalte Benachrichtigungen ein und du bekommst eine Nachricht, sobald ein neuer Arbeitseinsatz ansteht.
        </p>
        <button
          type="button"
          onClick={subscribe}
          disabled={busy !== null}
          className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 font-semibold text-[#1f3f8f] shadow-sm transition active:scale-95 disabled:opacity-70"
        >
          {busy === "subscribe" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Bell className="size-4" aria-hidden="true" />
          )}
          Benachrichtigungen einschalten
        </button>
      </div>
    </section>
  );
}
