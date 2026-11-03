import { NextResponse } from "next/server";
import { buildEventNotification, CreateEventSchema, type ClubEvent } from "@/lib/club/events";
import {
  clubDb,
  forbiddenResponse,
  isMissingTableError,
  isOrganizerCode,
  missingMigrationResponse,
  notifyAllMembers,
  organizerCodeFrom,
} from "@/lib/server/club";

export const dynamic = "force-dynamic";

// Events from the last 60 days and all upcoming ones are enough for the prototype.
const PAST_DAYS = 60;

/** Lists events with the names signed up for them (never the remove tokens). */
export async function GET() {
  try {
    const db = clubDb();
    const since = new Date(Date.now() - PAST_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: events, error } = await db
      .from("club_events")
      .select("id, title, description, location, starts_at, ends_at, helpers_needed, created_at")
      .gte("starts_at", since)
      .order("starts_at");
    if (isMissingTableError(error)) return missingMigrationResponse();
    if (error) throw error;

    const ids = (events ?? []).map((event) => event.id);
    const { data: signups, error: signupError } = ids.length
      ? await db
          .from("club_event_signups")
          .select("id, event_id, name, created_at")
          .in("event_id", ids)
          .order("created_at")
      : { data: [], error: null };
    if (signupError) throw signupError;

    const result: ClubEvent[] = (events ?? []).map((event) => ({
      ...event,
      signups: (signups ?? [])
        .filter((signup) => signup.event_id === event.id)
        .map(({ id, name, created_at }) => ({ id, name, created_at })),
    }));
    return NextResponse.json({ events: result });
  } catch (error) {
    console.error("Loading club events failed", error);
    return NextResponse.json({ error: "Die Einsätze konnten nicht geladen werden." }, { status: 500 });
  }
}

/** Creates an event (organizers only) and, unless turned off, notifies every member. */
export async function POST(request: Request) {
  if (!isOrganizerCode(organizerCodeFrom(request))) return forbiddenResponse();

  const parsed = CreateEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Bitte die Angaben prüfen." },
      { status: 400 },
    );
  }
  const input = parsed.data;

  try {
    const { data: event, error } = await clubDb()
      .from("club_events")
      .insert({
        title: input.title,
        description: input.description,
        location: input.location,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        helpers_needed: input.helpersNeeded,
      })
      .select("id, title, description, location, starts_at, ends_at, helpers_needed, created_at")
      .single();
    if (isMissingTableError(error)) return missingMigrationResponse();
    if (error) throw error;

    const push = input.notify ? await notifyAllMembers(buildEventNotification(event)) : null;
    return NextResponse.json({ event: { ...event, signups: [] }, push });
  } catch (error) {
    console.error("Creating club event failed", error);
    return NextResponse.json({ error: "Der Einsatz konnte nicht gespeichert werden." }, { status: 500 });
  }
}
