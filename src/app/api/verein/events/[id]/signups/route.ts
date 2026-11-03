import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { SignupSchema } from "@/lib/club/events";
import { clubDb, isMissingTableError, missingMigrationResponse } from "@/lib/server/club";

// Keeps a single event from being flooded; far above what a club work day needs.
const MAX_SIGNUPS_PER_EVENT = 200;

/** Signs a name up for an event. Returns the token that lets this device take it back. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const parsed = SignupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !z.uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: parsed.error?.issues[0]?.message ?? "Unbekannter Einsatz." }, { status: 400 });
  }

  try {
    const db = clubDb();
    const { count, error: countError } = await db
      .from("club_event_signups")
      .select("id", { count: "exact", head: true })
      .eq("event_id", params.id);
    if (isMissingTableError(countError)) return missingMigrationResponse();
    if (countError) throw countError;
    if ((count ?? 0) >= MAX_SIGNUPS_PER_EVENT) {
      return NextResponse.json({ error: "Für diesen Einsatz sind schon sehr viele eingetragen." }, { status: 409 });
    }

    const { data, error } = await db
      .from("club_event_signups")
      .insert({ event_id: params.id, name: parsed.data.name })
      .select("id, name, created_at, remove_token")
      .single();
    // 23503: the event was deleted in the meantime.
    if (error?.code === "23503") {
      return NextResponse.json({ error: "Diesen Einsatz gibt es nicht mehr." }, { status: 404 });
    }
    if (error) throw error;

    return NextResponse.json({ signup: data });
  } catch (error) {
    console.error("Club signup failed", error);
    return NextResponse.json({ error: "Das Eintragen hat nicht geklappt." }, { status: 500 });
  }
}

const RemoveSchema = z.object({ signupId: z.uuid(), token: z.uuid() });

/** Takes a signup back; needs the token handed out when signing up. */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const parsed = RemoveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Das Austragen hat nicht geklappt." }, { status: 400 });
  }

  const { error } = await clubDb()
    .from("club_event_signups")
    .delete()
    .eq("id", parsed.data.signupId)
    .eq("event_id", params.id)
    .eq("remove_token", parsed.data.token);
  if (error) {
    console.error("Removing club signup failed", error);
    return NextResponse.json({ error: "Das Austragen hat nicht geklappt." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
