import { z } from "zod/v4";

// Club work assignments ("Arbeitseinsätze") at /verein. Shared by the API routes and the screen.

export const CLUB_NAME = "Vereinsapp";
export const CLUB_TIME_ZONE = "Europe/Berlin";

export interface ClubSignup {
  id: string;
  name: string;
  created_at: string;
}

export interface ClubEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string | null;
  helpers_needed: number | null;
  created_at: string;
  signups: ClubSignup[];
}

export const CreateEventSchema = z
  .object({
    title: z.string().trim().min(1, "Bitte einen Titel eingeben").max(120),
    description: z.string().trim().max(2000).default(""),
    location: z.string().trim().max(120).default(""),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }).nullable().default(null),
    helpersNeeded: z.number().int().min(1).max(500).nullable().default(null),
    notify: z.boolean().default(true),
  })
  .refine((value) => !value.endsAt || Date.parse(value.endsAt) > Date.parse(value.startsAt), {
    message: "Das Ende muss nach dem Beginn liegen",
    path: ["endsAt"],
  });

export type CreateEventInput = z.input<typeof CreateEventSchema>;

export const SignupSchema = z.object({
  name: z.string().trim().min(1, "Bitte deinen Namen eingeben").max(60),
});

/**
 * Turns the date and time fields of the form ("2026-11-14", "09:00") into an ISO timestamp.
 * The form runs in the member's browser, so its local time zone is the one they meant.
 */
export function localDateTimeToIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const value = new Date(year, month - 1, day, hours, minutes);
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

/**
 * Splits events into upcoming (soonest first) and past (latest first). An event counts as
 * upcoming until it has ended, or until the end of its day when it has no end time.
 */
export function splitEvents<T extends Pick<ClubEvent, "starts_at" | "ends_at">>(events: T[], now: Date) {
  const upcoming: T[] = [];
  const past: T[] = [];

  for (const event of events) {
    const end = event.ends_at ? new Date(event.ends_at) : endOfDay(new Date(event.starts_at));
    (end.getTime() >= now.getTime() ? upcoming : past).push(event);
  }

  upcoming.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  past.sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at));
  return { upcoming, past };
}

function endOfDay(date: Date) {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

const dayFormat = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: CLUB_TIME_ZONE,
});
const timeFormat = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: CLUB_TIME_ZONE,
});
const dayNumberFormat = new Intl.DateTimeFormat("de-DE", { day: "numeric", timeZone: CLUB_TIME_ZONE });
const monthShortFormat = new Intl.DateTimeFormat("de-DE", { month: "short", timeZone: CLUB_TIME_ZONE });

/** "Samstag, 14. November" */
export function formatEventDay(startsAt: string) {
  return dayFormat.format(new Date(startsAt));
}

/** "09:00 – 13:00 Uhr" or "09:00 Uhr" */
export function formatEventTime(startsAt: string, endsAt: string | null) {
  const start = timeFormat.format(new Date(startsAt));
  return endsAt ? `${start} – ${timeFormat.format(new Date(endsAt))} Uhr` : `${start} Uhr`;
}

/** The calendar sheet on each card: { day: "14", month: "Nov" } */
export function formatDateBadge(startsAt: string) {
  const date = new Date(startsAt);
  return {
    day: dayNumberFormat.format(date).replace(".", ""),
    month: monthShortFormat.format(date).replace(".", ""),
  };
}

/** How full an event is, for the progress bar and the label next to it. */
export function signupStatus(count: number, needed: number | null) {
  if (needed === null) {
    return {
      label: count === 0 ? "Noch niemand dabei" : `${count} ${count === 1 ? "Person" : "Personen"} dabei`,
      progress: null,
      full: false,
    };
  }
  const missing = Math.max(needed - count, 0);
  return {
    label: missing === 0 ? `Voll besetzt (${count}/${needed})` : `${count} von ${needed} · noch ${missing} gesucht`,
    progress: Math.min(count / needed, 1),
    full: missing === 0,
  };
}

export interface ClubNotification {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/** What members see on their lock screen when an event is announced. */
export function buildEventNotification(
  event: Pick<ClubEvent, "id" | "title" | "starts_at" | "ends_at" | "location">,
): ClubNotification {
  const when = `${formatEventDay(event.starts_at)}, ${formatEventTime(event.starts_at, event.ends_at)}`;
  return {
    title: `Neuer Arbeitseinsatz: ${event.title}`,
    body: event.location ? `${when} · ${event.location}` : when,
    url: `/verein#einsatz-${event.id}`,
    tag: `einsatz-${event.id}`,
  };
}

/** "Anna Müller" → "AM", for the little avatars of people who signed up. */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}
