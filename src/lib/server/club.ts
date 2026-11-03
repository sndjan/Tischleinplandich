import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import webpush from "web-push";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { ClubNotification } from "@/lib/club/events";

// Server side of the club prototype at /verein. Members have no account, so every
// read and write goes through the service role; organizers prove themselves with a
// shared code (CLUB_ADMIN_CODE) instead.

export const MIGRATION_HINT =
  "Die Vereinsapp braucht noch ein Datenbank-Update (supabase/migrations/030_club_work_events.sql).";

/** PostgREST reports a table that doesn't exist yet as PGRST205, Postgres as 42P01. */
export function isMissingTableError(error: { code?: string } | null | undefined) {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

export function missingMigrationResponse() {
  return NextResponse.json({ error: MIGRATION_HINT, missingMigration: true }, { status: 503 });
}

export function clubDb() {
  return createAdminSupabaseClient();
}

/** Compares in constant time, hashing first so different lengths don't throw. */
export function isOrganizerCode(code: string | null | undefined) {
  const expected = process.env.CLUB_ADMIN_CODE;
  if (!expected || !code) return false;
  const a = createHash("sha256").update(code.trim()).digest();
  const b = createHash("sha256").update(expected.trim()).digest();
  return timingSafeEqual(a, b);
}

export function organizerCodeFrom(request: Request) {
  return request.headers.get("x-club-code");
}

export function forbiddenResponse() {
  const configured = Boolean(process.env.CLUB_ADMIN_CODE);
  return NextResponse.json(
    {
      error: configured
        ? "Der Organisator-Code stimmt nicht."
        : "Es ist noch kein Organisator-Code eingerichtet (CLUB_ADMIN_CODE).",
    },
    { status: 403 },
  );
}

let vapidReady: boolean | null = null;

function ensureVapid() {
  if (vapidReady !== null) return vapidReady;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:hallo@tischleinplandich.de";
  vapidReady = Boolean(publicKey && privateKey);
  if (vapidReady) webpush.setVapidDetails(subject, publicKey!, privateKey!);
  return vapidReady;
}

export interface StoredSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Sends one notification to the given devices. Subscriptions the push service no longer
 * knows (the member uninstalled the app or revoked the permission) are deleted.
 */
export async function sendClubNotification(subscriptions: StoredSubscription[], notification: ClubNotification) {
  if (!ensureVapid()) {
    return { sent: 0, failed: subscriptions.length, configured: false };
  }

  const payload = JSON.stringify(notification);
  const gone: string[] = [];
  let sent = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          payload,
          // Without a TTL the notification would be dropped when the phone is offline.
          { TTL: 24 * 60 * 60, urgency: "high" },
        );
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          gone.push(subscription.id);
        } else {
          console.error("Club push failed", status, (error as Error).message);
        }
      }
    }),
  );

  if (gone.length > 0) {
    await clubDb().from("club_push_subscriptions").delete().in("id", gone);
  }

  return { sent, failed: subscriptions.length - sent, configured: true };
}

/** Notifies every device that turned on notifications. */
export async function notifyAllMembers(notification: ClubNotification) {
  const { data, error } = await clubDb().from("club_push_subscriptions").select("id, endpoint, p256dh, auth");
  if (error) throw error;
  return sendClubNotification(data ?? [], notification);
}
