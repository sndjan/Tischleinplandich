import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { clubDb, isMissingTableError, missingMigrationResponse } from "@/lib/server/club";

const SubscriptionSchema = z.object({
  endpoint: z.url().max(1000).startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** Stores (or refreshes) a device's push subscription. */
export async function POST(request: Request) {
  const parsed = SubscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültiges Abo." }, { status: 400 });
  }

  const { endpoint, keys } = parsed.data;
  const { error } = await clubDb()
    .from("club_push_subscriptions")
    .upsert({ endpoint, p256dh: keys.p256dh, auth: keys.auth }, { onConflict: "endpoint" });
  if (isMissingTableError(error)) return missingMigrationResponse();
  if (error) {
    console.error("Saving club push subscription failed", error);
    return NextResponse.json({ error: "Benachrichtigungen konnten nicht aktiviert werden." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** Forgets a device; knowing its endpoint (a long random URL) is proof enough. */
export async function DELETE(request: Request) {
  const parsed = z.object({ endpoint: z.string().max(1000) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: true });

  const { error } = await clubDb().from("club_push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);
  if (error && !isMissingTableError(error)) {
    console.error("Removing club push subscription failed", error);
  }
  return NextResponse.json({ ok: true });
}
