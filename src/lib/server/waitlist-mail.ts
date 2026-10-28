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
      html: confirmationHtml(confirmUrl, unsubscribeUrl),
      text: `Bitte bestätige deine Anmeldung bei ${SITE_NAME}: ${confirmUrl}\n\nWarst du das nicht? Dann ignoriere diese Mail einfach.\n\nEintrag löschen: ${unsubscribeUrl}`,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Resend responded ${response.status}: ${await response.text()}`);
  }
}

const HEADING_FONT = "Nunito,'Arial Rounded MT Bold',Helvetica,Arial,sans-serif";
const BODY_FONT = "'DM Sans',Helvetica,Arial,sans-serif";

// Same look as the sign-in mail (supabase/templates/sign-in.html): inline styles
// and tables only, since mail clients drop <style> and flexbox.
function confirmationHtml(confirmUrl: string, unsubscribeUrl: string) {
  return `<!doctype html>
<html lang="de">
  <body style="margin:0;padding:0;background:#f7f6f3;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f6f3;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
            <tr>
              <td align="center" style="padding-bottom:20px;font-family:${HEADING_FONT};font-size:20px;font-weight:900;color:#1c2b22;">
                <span style="display:inline-block;width:32px;height:32px;line-height:32px;border-radius:9px;background:#4f9d6e;font-size:18px;vertical-align:middle;">🍴</span>
                <span style="vertical-align:middle;padding-left:8px;">${SITE_NAME}</span>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border:1px solid #ececec;border-radius:24px;padding:36px 28px;text-align:center;">
                <div style="display:inline-block;width:72px;height:72px;line-height:72px;border-radius:22px;background:#eaf3ec;font-size:40px;">📬</div>
                <h1 style="margin:20px 0 8px;font-family:${HEADING_FONT};font-size:26px;font-weight:800;line-height:1.2;color:#1c2b22;">Fast geschafft!</h1>
                <p style="margin:0 0 28px;font-family:${BODY_FONT};font-size:15px;line-height:1.55;color:#63706a;">Bitte bestätige deine Anmeldung für die Warteliste. Dann sagen wir dir Bescheid, sobald es losgeht.</p>
                <a href="${confirmUrl}" style="display:inline-block;background:#2f7a52;color:#ffffff;font-family:${BODY_FONT};font-size:17px;font-weight:700;text-decoration:none;padding:16px 36px;border-radius:999px;">Anmeldung bestätigen</a>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 12px 0;font-family:${BODY_FONT};font-size:12px;line-height:1.6;color:#9aa79f;">
                Warst du das nicht? Dann ignoriere diese Mail einfach, wir schreiben dir nicht noch einmal.<br />
                <a href="${unsubscribeUrl}" style="color:#9aa79f;">Eintrag löschen</a> &nbsp;·&nbsp; <a href="${SITE_URL}/impressum" style="color:#9aa79f;">Impressum</a> &nbsp;·&nbsp; <a href="${SITE_URL}/datenschutz" style="color:#9aa79f;">Datenschutz</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
