"use client";

import { useState } from "react";
import { Bell, Loader2, Send } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { localDateTimeToIso, type ClubEvent } from "@/lib/club/events";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-12 w-full min-w-0 rounded-2xl border border-[#d9dfea] bg-white px-4 text-base text-[#16213a] outline-none transition placeholder:text-[#a3acbd] focus:border-[#2f5fd0] focus:ring-4 focus:ring-[#2f5fd0]/15";
const labelClass = "mb-1.5 block text-sm font-semibold text-[#35405a]";

/** Next Saturday as YYYY-MM-DD: most club work days are on a Saturday morning. */
function nextSaturday() {
  const date = new Date();
  date.setDate(date.getDate() + (((6 - date.getDay() + 7) % 7) || 7));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

interface CreateEventSheetProps {
  code: string;
  subscribers: number | null;
  onClose: () => void;
  onCreated: (event: ClubEvent, notified: number | null) => void;
}

export function CreateEventSheet({ code, subscribers, onClose, onCreated }: CreateEventSheetProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(nextSaturday);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [location, setLocation] = useState("");
  const [helpers, setHelpers] = useState("");
  const [description, setDescription] = useState("");
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (formEvent: React.FormEvent) => {
    formEvent.preventDefault();
    setError(null);

    const startsAt = localDateTimeToIso(date, startTime);
    const endsAt = endTime ? localDateTimeToIso(date, endTime) : null;
    if (!title.trim()) return setError("Bitte gib dem Einsatz einen Titel.");
    if (!startsAt) return setError("Bitte Datum und Beginn angeben.");
    if (endsAt && endsAt <= startsAt) return setError("Das Ende muss nach dem Beginn liegen.");

    setSaving(true);
    try {
      const response = await fetch("/api/verein/events", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-club-code": code },
        body: JSON.stringify({
          title,
          description,
          location,
          startsAt,
          endsAt,
          helpersNeeded: helpers ? Number(helpers) : null,
          notify,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Der Einsatz konnte nicht gespeichert werden.");
      onCreated(body.event as ClubEvent, body.push ? body.push.sent : null);
    } catch (submitError) {
      setError((submitError as Error).message);
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      title="Neuer Arbeitseinsatz"
      description="Alle mit eingeschalteten Benachrichtigungen bekommen direkt Bescheid."
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="club-title" className={labelClass}>
            Titel
          </label>
          <input
            id="club-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="z. B. Platzpflege vor der Saison"
            className={fieldClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <label htmlFor="club-date" className={labelClass}>
              Datum
            </label>
            <input
              id="club-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={cn(fieldClass, "min-w-0 appearance-none px-3")}
            />
          </div>
          <div>
            <label htmlFor="club-start" className={labelClass}>
              Von
            </label>
            <input
              id="club-start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={cn(fieldClass, "min-w-0 appearance-none px-3")}
            />
          </div>
          <div>
            <label htmlFor="club-end" className={labelClass}>
              Bis
            </label>
            <input
              id="club-end"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={cn(fieldClass, "min-w-0 appearance-none px-3")}
            />
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div>
            <label htmlFor="club-location" className={labelClass}>
              Ort
            </label>
            <input
              id="club-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={120}
              placeholder="z. B. Vereinsheim"
              className={fieldClass}
            />
          </div>
          <div className="w-28">
            <label htmlFor="club-helpers" className={labelClass}>
              Helfer
            </label>
            <input
              id="club-helpers"
              type="number"
              inputMode="numeric"
              min={1}
              max={500}
              value={helpers}
              onChange={(e) => setHelpers(e.target.value)}
              placeholder="offen"
              className={fieldClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="club-description" className={labelClass}>
            Beschreibung
          </label>
          <textarea
            id="club-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="Was steht an? Was sollen alle mitbringen?"
            className={cn(fieldClass, "h-auto resize-none py-3 leading-relaxed")}
          />
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-[#f5f7fb] p-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#2f5fd0]">
            <Bell className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-[#16213a]">Alle benachrichtigen</span>
            <span className="block text-sm text-[#5b6680]">
              {subscribers === null
                ? "Push-Nachricht an alle Geräte"
                : `Push-Nachricht an ${subscribers} ${subscribers === 1 ? "Gerät" : "Geräte"}`}
            </span>
          </span>
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="relative h-7 w-12 shrink-0 rounded-full bg-[#cfd6e3] transition peer-checked:bg-[#2f5fd0] peer-focus-visible:ring-4 peer-focus-visible:ring-[#2f5fd0]/20 after:absolute after:left-0.5 after:top-0.5 after:size-6 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5"
          />
        </label>

        {error && <p className="rounded-2xl bg-[#fdeaea] px-4 py-3 text-sm font-medium text-[#a12f2f]">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#2f5fd0] font-semibold text-white shadow-[0_10px_22px_-12px_rgba(47,95,208,0.9)] transition active:scale-[0.98] disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-4" />}
          {notify ? "Erstellen und alle benachrichtigen" : "Erstellen"}
        </button>
      </form>
    </BottomSheet>
  );
}

interface OrganizerSheetProps {
  onClose: () => void;
  onUnlocked: (code: string, subscribers: number) => void;
}

/** Asks once for the shared organizer code; the device remembers it afterwards. */
export function OrganizerSheet({ onClose, onUnlocked }: OrganizerSheetProps) {
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (formEvent: React.FormEvent) => {
    formEvent.preventDefault();
    setChecking(true);
    setError(null);
    const response = await fetch("/api/verein/organizer", {
      method: "POST",
      headers: { "x-club-code": code },
    }).catch(() => null);
    const body = await response?.json().catch(() => null);
    setChecking(false);
    if (!response?.ok) return setError(body?.error ?? "Das hat nicht geklappt.");
    onUnlocked(code, body.subscribers);
  };

  return (
    <BottomSheet
      title="Für Organisatoren"
      description="Mit dem Organisator-Code des Vereins kannst du Einsätze erstellen und löschen."
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <input
          autoFocus
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Organisator-Code"
          aria-label="Organisator-Code"
          autoComplete="current-password"
          className={fieldClass}
        />
        {error && <p className="rounded-2xl bg-[#fdeaea] px-4 py-3 text-sm font-medium text-[#a12f2f]">{error}</p>}
        <button
          type="submit"
          disabled={checking || !code}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#16213a] font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          {checking && <Loader2 className="size-5 animate-spin" />}
          Freischalten
        </button>
      </form>
    </BottomSheet>
  );
}
