import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";
import { formatRewardDays, REWARD_DAYS, YEARLY_REWARD_LIMIT_DAYS } from "@/lib/feedback-rewards";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Premium für Feedback",
  alternates: { canonical: "/feedback-belohnung" },
};

// Conditions of the feedback reward (migration 017). Promotions must state their
// conditions clearly up front (§ 5a UWG), so keep this in sync with the function.
export default function FeedbackRewardPage() {
  return (
    <LegalPage title="Premium für Feedback">
      <p>
        Deine Ideen und Fehlermeldungen machen {SITE_NAME} besser. Bauen wir etwas ein, das du vorgeschlagen hast,
        oder beheben einen Fehler, den du gemeldet hast, bedanken wir uns mit Premium.
      </p>

      <h2>Wie viel du bekommst</h2>
      <ul>
        <li>
          <strong>Kleine Änderung</strong> (z. B. eine Anzeige mehr, ein kleiner Fehler):{" "}
          {formatRewardDays(REWARD_DAYS.small)}
        </li>
        <li>
          <strong>Spürbare Verbesserung</strong> (z. B. ein neuer Filter, ein Fehler, der eine Funktion blockiert):{" "}
          {formatRewardDays(REWARD_DAYS.medium)}
        </li>
        <li>
          <strong>Große Funktion</strong> (z. B. gemeinsame Rezepte, ein schwerer Fehler wie Datenverlust):{" "}
          {formatRewardDays(REWARD_DAYS.large)}
        </li>
      </ul>
      <p>Wie groß eine Änderung ist, entscheiden wir.</p>

      <h2>Bedingungen</h2>
      <ul>
        <li>
          Belohnt wird nur Feedback, das wir tatsächlich umsetzen bzw. beheben. Was wir umsetzen, entscheiden wir
          allein; einen Anspruch darauf gibt es nicht.
        </li>
        <li>
          Haben mehrere dasselbe vorgeschlagen, bekommt es, wer es zuerst über die App geschickt hat. Als Dank können
          wir auch anderen etwas schenken, müssen es aber nicht.
        </li>
        <li>Es zählt nur Feedback, das du angemeldet über die Feedback-Funktion in der App schickst.</li>
        <li>
          Pro Konto gibt es höchstens {formatRewardDays(YEARLY_REWARD_LIMIT_DAYS)} innerhalb von zwölf Monaten.
          Mehrere Belohnungen addieren sich bis zu dieser Grenze.
        </li>
        <li>
          Solange es Premium noch nicht gibt, schreiben wir dir die Zeit gut. Sie läuft ab dem Start von Premium.
        </li>
        <li>
          Premium-Zeit kann nicht ausgezahlt oder auf andere Konten übertragen werden. Löschst du dein Konto, verfällt
          sie.
        </li>
        <li>
          Wir können die Aktion jederzeit beenden oder ändern. Was du bis dahin bekommen hast, bleibt dir.
        </li>
      </ul>

      <h2>Deine Daten</h2>
      <p>
        Damit wir dich belohnen können, ist dein Feedback mit deinem Konto verknüpft. Mehr dazu steht in der{" "}
        <Link href="/datenschutz">Datenschutzerklärung</Link>.
      </p>
    </LegalPage>
  );
}
