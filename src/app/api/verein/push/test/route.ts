import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { clubDb, isMissingTableError, missingMigrationResponse, sendClubNotification } from "@/lib/server/club";

/** Sends a test notification to the calling device only, to check the setup end to end. */
export async function POST(request: Request) {
  const parsed = z.object({ endpoint: z.string().max(1000) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültiges Abo." }, { status: 400 });

  const { data, error } = await clubDb()
    .from("club_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("endpoint", parsed.data.endpoint);
  if (isMissingTableError(error)) return missingMigrationResponse();
  if (error || !data?.length) {
    return NextResponse.json({ error: "Dieses Gerät ist nicht angemeldet. Bitte Benachrichtigungen neu aktivieren." }, { status: 404 });
  }

  const result = await sendClubNotification(data, {
    title: "Test-Benachrichtigung",
    body: "Klappt! So erfährst du von neuen Arbeitseinsätzen.",
    url: "/verein",
    tag: "test",
  });
  if (!result.configured) {
    return NextResponse.json({ error: "Push ist auf dem Server noch nicht eingerichtet (VAPID-Schlüssel fehlen)." }, { status: 503 });
  }
  if (result.sent === 0) {
    return NextResponse.json({ error: "Die Benachrichtigung konnte nicht zugestellt werden." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
