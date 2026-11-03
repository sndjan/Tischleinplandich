import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { clubDb, forbiddenResponse, isOrganizerCode, organizerCodeFrom } from "@/lib/server/club";

/** Deletes an event with its signups (organizers only). */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  if (!isOrganizerCode(organizerCodeFrom(request))) return forbiddenResponse();
  if (!z.uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Unbekannter Einsatz." }, { status: 404 });
  }

  const { error } = await clubDb().from("club_events").delete().eq("id", params.id);
  if (error) {
    console.error("Deleting club event failed", error);
    return NextResponse.json({ error: "Der Einsatz konnte nicht gelöscht werden." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
