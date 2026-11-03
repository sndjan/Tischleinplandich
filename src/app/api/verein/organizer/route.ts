import { NextResponse } from "next/server";
import { clubDb, forbiddenResponse, isOrganizerCode, organizerCodeFrom } from "@/lib/server/club";

/** Checks the organizer code and tells the organizer how many devices would be notified. */
export async function POST(request: Request) {
  if (!isOrganizerCode(organizerCodeFrom(request))) return forbiddenResponse();

  const { count } = await clubDb().from("club_push_subscriptions").select("id", { count: "exact", head: true });
  return NextResponse.json({ ok: true, subscribers: count ?? 0 });
}
