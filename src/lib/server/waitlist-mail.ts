import "server-only";
import { SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * Sends the double opt-in mail through Resend. Throws when Resend is not set up
 * (RESEND_API_KEY, WAITLIST_FROM_EMAIL) or refuses the mail.
 */
export async function sendWaitlistConfirmation(email: string, token: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.WAITLIST_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY or WAITLIST_FROM_EMAIL is not set");
  }

  const confirmUrl = `${SITE_URL}/warteliste?token=${token}`;
  const unsubscribeUrl = `${SITE_URL}/warteliste?token=${token}&aktion=abmelden`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: email,
      subject: `Bitte bestätige deine Anmeldung bei ${SITE_NAME}`,
      html: `<p>Hallo,</p>
<p>du hast dich für die Warteliste von ${SITE_NAME} eingetragen. Bitte bestätige das mit einem Klick:</p>
<p><a href="${confirmUrl}">Anmeldung bestätigen</a></p>
<p>Warst du das nicht? Dann ignoriere diese Mail einfach, wir schreiben dir nicht noch einmal.</p>
<p style="color:#6b7a71;font-size:13px"><a href="${unsubscribeUrl}" style="color:#6b7a71">Eintrag löschen</a></p>`,
      text: `Bitte bestätige deine Anmeldung bei ${SITE_NAME}: ${confirmUrl}\n\nWarst du das nicht? Dann ignoriere diese Mail einfach.\n\nEintrag löschen: ${unsubscribeUrl}`,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Resend responded ${response.status}: ${await response.text()}`);
  }
}
