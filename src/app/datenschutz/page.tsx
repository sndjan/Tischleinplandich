import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { LEGAL_UPDATED, OPERATOR, SUPABASE_REGION } from "@/lib/legal";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Datenschutzerklärung",
  alternates: { canonical: "/datenschutz" },
};

// Draft that matches what the app does today (hosting on Vercel, Supabase,
// Claude for AI features, Resend for waitlist mails, Cloudflare Turnstile).
// Update it whenever a new service is added, and have it checked before selling.
export default function DatenschutzPage() {
  return (
    <LegalPage title="Datenschutzerklärung">
      <p>
        Hier steht, welche Daten {SITE_NAME} verarbeitet, wofür und welche Rechte du hast. Kurz gesagt: Wir
        verarbeiten nur, was für die App nötig ist, nutzen kein Tracking und keine Werbung.
      </p>

      <h2>1. Verantwortlicher</h2>
      <p>
        {OPERATOR.name}, {OPERATOR.street}, {OPERATOR.city}, {OPERATOR.country}
        <br />
        E-Mail: <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>
      </p>

      <h2>2. Hosting und Server-Logs</h2>
      <p>
        Die Website wird bei Vercel Inc. (440 N Barranca Ave #4133, Covina, CA 91723, USA) gehostet. Beim Aufruf
        verarbeitet Vercel technisch notwendige Daten wie IP-Adresse, Zeitpunkt, aufgerufene Seite und
        Browserkennung, um die Seite auszuliefern und vor Angriffen zu schützen. Rechtsgrundlage ist unser
        berechtigtes Interesse an einem sicheren Betrieb (Art. 6 Abs. 1 lit. f DSGVO). Mit Vercel besteht ein
        Auftragsverarbeitungsvertrag; die Übermittlung in die USA stützt sich auf das EU-US Data Privacy
        Framework und Standardvertragsklauseln.
      </p>

      <h2>3. Schutz vor Missbrauch (Cloudflare Turnstile)</h2>
      <p>
        Bei der Anmeldung und beim Eintrag in die Warteliste prüfen wir mit Cloudflare Turnstile, ob ein Mensch das
        Formular abschickt, damit niemand unsere Formulare für massenhafte Mails missbraucht. Dafür verarbeitet
        Cloudflare, Inc. (101 Townsend St, San Francisco, CA 94107, USA) technische Daten wie IP-Adresse,
        Browser- und Geräteeigenschaften; Turnstile setzt dafür keine Cookies. Rechtsgrundlage ist unser
        berechtigtes Interesse an einem sicheren Betrieb (Art. 6 Abs. 1 lit. f DSGVO). Mit Cloudflare besteht ein
        Auftragsverarbeitungsvertrag; die Übermittlung in die USA stützt sich auf das EU-US Data Privacy Framework.
      </p>

      <h2>4. Konto und Anmeldung</h2>
      <p>
        Für ein Konto brauchst du nur deine E-Mail-Adresse. Wir schicken dir einen Anmeldelink bzw. Code. Konto,
        Anmeldung und alle App-Daten speichert Supabase Inc. für uns in der Region {SUPABASE_REGION}.
        Rechtsgrundlage ist die Erfüllung des Nutzungsvertrags (Art. 6 Abs. 1 lit. b DSGVO). Mit Supabase besteht
        ein Auftragsverarbeitungsvertrag.
      </p>

      <h2>5. Daten in der App</h2>
      <p>
        Wir speichern, was du in der App anlegst: Rezepte, Fotos, Wochenpläne, Einkaufslisten, Grundzutaten,
        Bewertungen, deinen Anzeigenamen sowie freiwillige Tagesziele für Kalorien und Nährwerte. Diese Daten sind
        nur für dich sichtbar, solange du sie nicht teilst. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
      </p>

      <h2>6. Rezepte teilen</h2>
      <p>
        Teilst du ein Rezept per Link, kann jede Person mit dem Link das Rezept samt Foto und deinem Anzeigenamen
        sehen. Schaltest du „In Entdecken zeigen“ ein, sehen es alle angemeldeten Nutzer. Beides kannst du
        jederzeit wieder abschalten.
      </p>

      <h2>7. KI-Funktionen</h2>
      <p>
        Wenn du ein Rezept per KI importierst, aus einer Idee erstellen oder mit KI ändern lässt, senden wir die
        dafür nötigen Inhalte (Text, Link-Inhalt, Fotos oder PDFs und ggf. das Rezept) an Anthropic PBC (548 Market
        St, San Francisco, CA 94104, USA), um das Rezept zu erzeugen. Deine E-Mail-Adresse wird dabei nicht
        übermittelt. Anthropic nutzt diese Daten nach eigenen Angaben nicht zum Training. Rechtsgrundlage ist Art. 6
        Abs. 1 lit. b DSGVO; die Übermittlung in die USA stützt sich auf Standardvertragsklauseln. Um Missbrauch zu
        verhindern, zählen wir die KI-Anfragen pro Tag.
      </p>

      <h2>8. Feedback</h2>
      <p>
        Schickst du uns Feedback aus der App, speichern wir deine Nachricht, die Stelle in der App und deine
        Browserkennung, um Fehler nachvollziehen zu können (Art. 6 Abs. 1 lit. f DSGVO). Zum Sortieren lassen
        wir Nachricht und Stelle in der App von Anthropic PBC (USA) zusammenfassen, ohne deine E-Mail-Adresse und
        Browserkennung. Daraus entstehen Aufgaben in unserem öffentlichen Code-Verzeichnis bei GitHub, Inc. (USA):
        nur in eigenen Worten, ohne deine Nachricht im Wortlaut und ohne Angaben, die auf dich schließen lassen.
        Die Übermittlung in die USA stützt sich auf Standardvertragsklauseln.
      </p>

      <h2>9. Warteliste</h2>
      <p>
        Trägst du dich in die Warteliste ein, speichern wir deine E-Mail-Adresse und den Zeitpunkt deiner
        Anmeldung. Du bekommst zuerst eine Mail zur Bestätigung (Double-Opt-in); erst danach schreiben wir dir, und
        zwar nur zum Start und zu Angeboten von {SITE_NAME}. Rechtsgrundlage ist deine Einwilligung (Art. 6 Abs. 1
        lit. a DSGVO), die du jederzeit über den Abmeldelink in jeder Mail widerrufen kannst. Die Mails versenden
        wir über Resend (Plus Five Five, Inc., USA) auf Grundlage eines Auftragsverarbeitungsvertrags und von
        Standardvertragsklauseln. Unbestätigte Einträge löschen wir nach 30 Tagen.
      </p>

      <h2>10. Cookies und Speicher im Browser</h2>
      <p>
        Wir setzen nur technisch notwendige Cookies für die Anmeldung und speichern zur schnelleren Anzeige deine
        App-Daten im Speicher deines Browsers (§ 25 Abs. 2 TDDDG). Es gibt keine Analyse-, Tracking- oder
        Werbe-Cookies.
      </p>

      <h2>11. Speicherdauer</h2>
      <p>
        Wir speichern deine Daten, solange du dein Konto hast. Im Profil kannst du dein Konto jederzeit löschen;
        dann werden alle Rezepte, Fotos, Pläne und Einstellungen sofort gelöscht. Feedback bleibt ohne Bezug zu
        deinem Konto erhalten. Gesetzliche Aufbewahrungspflichten (z. B. für Rechnungen) bleiben unberührt.
      </p>

      <h2>12. Deine Rechte</h2>
      <ul>
        <li>Auskunft (Art. 15 DSGVO)</li>
        <li>Berichtigung (Art. 16 DSGVO)</li>
        <li>Löschung (Art. 17 DSGVO)</li>
        <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
        <li>Datenübertragbarkeit (Art. 20 DSGVO) – z. B. per Rezept-Export im Profil</li>
        <li>Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21 DSGVO)</li>
        <li>Widerruf erteilter Einwilligungen mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO)</li>
      </ul>
      <p>
        Schreib uns dafür einfach an <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>. Außerdem kannst du
        dich bei einer Datenschutz-Aufsichtsbehörde beschweren, etwa der deines Wohnorts.
      </p>

      <p className="pt-6 text-sm text-brand-secondary">Stand: {LEGAL_UPDATED}</p>
    </LegalPage>
  );
}
