"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { CalendarPlus, ChevronDown, Hammer, KeyRound, LogOut, Plus, RefreshCw } from "lucide-react";
import { CLUB_NAME, splitEvents, type ClubEvent } from "@/lib/club/events";
import { clubStorage, type OwnSignup } from "./club-storage";
import { CreateEventSheet, OrganizerSheet } from "./create-event-sheet";
import { EventCard } from "./event-card";
import { NotifyCard } from "./notify-card";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready" };

/** The club app at /verein: upcoming work assignments, signing up, and notifications. */
export function ClubScreen() {
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [ownSignups, setOwnSignups] = useState<Record<string, OwnSignup>>({});
  const [name, setName] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [subscribers, setSubscribers] = useState<number | null>(null);
  const [sheet, setSheet] = useState<"create" | "organizer" | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/verein/events", { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Die Einsätze konnten nicht geladen werden.");
      setEvents(body.events as ClubEvent[]);
      setLoad({ status: "ready" });
    } catch (error) {
      setLoad({ status: "error", message: (error as Error).message });
    }
  }, []);

  useEffect(() => {
    setOwnSignups(clubStorage.getSignups());
    setName(clubStorage.getName());
    refresh();

    // A remembered organizer code is checked again, in case it was changed.
    const storedCode = clubStorage.getCode();
    if (storedCode) {
      fetch("/api/verein/organizer", { method: "POST", headers: { "x-club-code": storedCode } })
        .then(async (response) => {
          if (!response.ok) return clubStorage.setCode(null);
          setCode(storedCode);
          setSubscribers((await response.json()).subscribers ?? null);
        })
        .catch(() => undefined);
    }

    // Members mostly come back from a notification or the home screen: show what's new.
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  // A tapped notification opens /verein#einsatz-<id>: scroll there and highlight it.
  useEffect(() => {
    const readHash = () => {
      const match = window.location.hash.match(/^#einsatz-(.+)$/);
      setHighlightId(match ? match[1] : null);
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  useEffect(() => {
    if (!highlightId || load.status !== "ready") return;
    document.getElementById(`einsatz-${highlightId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    const timer = window.setTimeout(() => setHighlightId(null), 4000);
    return () => window.clearTimeout(timer);
  }, [highlightId, load.status]);

  const { upcoming, past } = useMemo(() => splitEvents(events, new Date()), [events]);

  const ownSignupFor = (event: ClubEvent) =>
    event.signups.find((signup) => ownSignups[signup.id]?.eventId === event.id)?.id ?? null;

  const saveOwnSignups = (next: Record<string, OwnSignup>) => {
    setOwnSignups(next);
    clubStorage.setSignups(next);
  };

  const signUp = async (event: ClubEvent, signupName: string) => {
    const response = await fetch(`/api/verein/events/${event.id}/signups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: signupName }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      toast.error(body?.error ?? "Das Eintragen hat nicht geklappt.");
      return false;
    }

    const { id, created_at, remove_token } = body.signup;
    saveOwnSignups({ ...ownSignups, [id]: { eventId: event.id, token: remove_token } });
    setName(signupName);
    clubStorage.setName(signupName);
    setEvents((current) =>
      current.map((item) =>
        item.id === event.id ? { ...item, signups: [...item.signups, { id, name: signupName, created_at }] } : item,
      ),
    );
    toast.success("Danke, du bist eingetragen!");
    return true;
  };

  const signOut = async (event: ClubEvent, signupId: string) => {
    const own = ownSignups[signupId];
    if (!own) return;
    const response = await fetch(`/api/verein/events/${event.id}/signups`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signupId, token: own.token }),
    });
    if (!response.ok) {
      toast.error("Das Austragen hat nicht geklappt.");
      return;
    }
    const next = { ...ownSignups };
    delete next[signupId];
    saveOwnSignups(next);
    setEvents((current) =>
      current.map((item) =>
        item.id === event.id ? { ...item, signups: item.signups.filter((signup) => signup.id !== signupId) } : item,
      ),
    );
    toast("Du bist ausgetragen");
  };

  const deleteEvent = async (event: ClubEvent) => {
    const response = await fetch(`/api/verein/events/${event.id}`, {
      method: "DELETE",
      headers: { "x-club-code": code ?? "" },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      toast.error(body?.error ?? "Der Einsatz konnte nicht gelöscht werden.");
      return;
    }
    setEvents((current) => current.filter((item) => item.id !== event.id));
    toast("Einsatz gelöscht");
  };

  const leaveOrganizerMode = () => {
    clubStorage.setCode(null);
    setCode(null);
    setSubscribers(null);
  };

  const isOrganizer = code !== null;

  return (
    <div className="min-h-dvh bg-[#f5f7fb] font-sans text-[#16213a]">
      <header className="sticky top-0 z-30 border-b border-[#e3e7ef]/80 bg-[#f5f7fb]/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-2xl items-center gap-3 px-4">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[#2f5fd0] text-white shadow-[0_6px_14px_-6px_rgba(47,95,208,0.9)]">
            <Hammer className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#8a94a8]">{CLUB_NAME}</p>
            <h1 className="font-heading text-xl font-black">Arbeitseinsätze</h1>
          </div>
          {isOrganizer ? (
            <button
              type="button"
              onClick={() => setSheet("create")}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#2f5fd0] px-4 text-sm font-semibold text-white shadow-[0_8px_18px_-10px_rgba(47,95,208,0.9)] transition active:scale-95"
            >
              <Plus className="size-4" strokeWidth={2.5} aria-hidden="true" />
              <span className="hidden sm:inline">Neuer Einsatz</span>
              <span className="sm:hidden">Neu</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSheet("organizer")}
              aria-label="Als Organisator anmelden"
              className="flex size-10 items-center justify-center rounded-full text-[#5b6680] transition hover:bg-white active:scale-90"
            >
              <KeyRound className="size-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 pb-[calc(3rem+env(safe-area-inset-bottom))] pt-5">
        <NotifyCard />

        {isOrganizer && (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#16213a] px-4 py-3 text-sm text-white">
            <span>
              <strong className="font-semibold">Organisator-Modus</strong>
              {subscribers !== null && (
                <span className="text-white/70">
                  {" "}
                  · {subscribers} {subscribers === 1 ? "Gerät" : "Geräte"} mit Benachrichtigungen
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={leaveOrganizerMode}
              aria-label="Organisator-Modus verlassen"
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}

        <section className="space-y-3">
          <h2 className="px-1 font-heading text-lg font-extrabold">
            Anstehend
            {load.status === "ready" && upcoming.length > 0 && (
              <span className="ml-2 rounded-full bg-[#e8effd] px-2 py-0.5 align-middle text-sm font-bold text-[#2f5fd0]">
                {upcoming.length}
              </span>
            )}
          </h2>

          {load.status === "loading" &&
            [0, 1].map((key) => <div key={key} className="h-56 animate-pulse rounded-3xl bg-white" />)}

          {load.status === "error" && (
            <div className="rounded-3xl border border-[#e3e7ef] bg-white p-6 text-center">
              <p className="text-[15px] text-[#35405a]">{load.message}</p>
              <button
                type="button"
                onClick={() => {
                  setLoad({ status: "loading" });
                  refresh();
                }}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-[#e8effd] px-4 text-sm font-semibold text-[#2f5fd0]"
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                Nochmal versuchen
              </button>
            </div>
          )}

          {load.status === "ready" && upcoming.length === 0 && (
            <div className="rounded-3xl border border-dashed border-[#cfd6e3] bg-white/60 px-6 py-10 text-center">
              <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#e8effd] text-[#2f5fd0]">
                <CalendarPlus className="size-7" aria-hidden="true" />
              </span>
              <p className="mt-4 font-heading text-lg font-extrabold">Gerade steht nichts an</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-[#5b6680]">
                Sobald es einen neuen Arbeitseinsatz gibt, siehst du ihn hier
                {isOrganizer ? "." : " – und bekommst eine Benachrichtigung."}
              </p>
              {isOrganizer && (
                <button
                  type="button"
                  onClick={() => setSheet("create")}
                  className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-[#2f5fd0] px-5 font-semibold text-white"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Ersten Einsatz erstellen
                </button>
              )}
            </div>
          )}

          {upcoming.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              highlighted={event.id === highlightId}
              ownSignupId={ownSignupFor(event)}
              defaultName={name}
              isOrganizer={isOrganizer}
              onSignUp={signUp}
              onSignOut={signOut}
              onDelete={deleteEvent}
            />
          ))}
        </section>

        {past.length > 0 && (
          <section className="space-y-3">
            <button
              type="button"
              onClick={() => setShowPast((value) => !value)}
              aria-expanded={showPast}
              className="flex w-full items-center justify-between rounded-2xl px-1 py-1 font-heading text-lg font-extrabold text-[#5b6680]"
            >
              Vergangene ({past.length})
              <ChevronDown
                className={`size-5 transition-transform ${showPast ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
            {showPast &&
              past.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  past
                  ownSignupId={ownSignupFor(event)}
                  defaultName={name}
                  isOrganizer={isOrganizer}
                  onSignUp={signUp}
                  onSignOut={signOut}
                  onDelete={deleteEvent}
                />
              ))}
          </section>
        )}
      </main>

      {sheet === "organizer" && (
        <OrganizerSheet
          onClose={() => setSheet(null)}
          onUnlocked={(newCode, count) => {
            clubStorage.setCode(newCode);
            setCode(newCode);
            setSubscribers(count);
            setSheet("create");
          }}
        />
      )}

      {sheet === "create" && code && (
        <CreateEventSheet
          code={code}
          subscribers={subscribers}
          onClose={() => setSheet(null)}
          onCreated={(event, notified) => {
            setEvents((current) => [...current, event]);
            setSheet(null);
            toast.success(
              notified === null
                ? "Einsatz erstellt"
                : `Einsatz erstellt – ${notified} ${notified === 1 ? "Gerät" : "Geräte"} benachrichtigt`,
            );
          }}
        />
      )}
    </div>
  );
}
