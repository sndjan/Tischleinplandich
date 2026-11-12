# Tischleinplandich

## Todos

- Select Foods macht aktuell nichts
- Legacy Foods rausnehmen
- Shopping list mit neuen Foods
- Auf Desktop ganze größe
- Rezept auswahl auf Mobile verbessern
- Man soll auch einzelne Lebensmittel (oder kombination aus diesen) einfügen können (als temporary meal?)
- KI-prompts für Bilder und Nährstoffe?
- Grün anstatt Orange
- Dialoge auf Mobile anpassen

### Später mit Claude Design

Feedback, das eine Neugestaltung braucht (Einträge in `feedback` bleiben auf `new`):

- Bewertung (Sterne) passt optisch noch nicht ins Rezept
- Filter der Rezeptliste insgesamt (Zeitfilter sitzt vorerst im Filtermenü)

### Später (größer)

- Drag & Drop: Rezept halten, Tage erscheinen, auf einen Tag ziehen

## Entwicklung

`.env.example` nach `.env.local` kopieren und ausfüllen, dann `npm install` und `npm run dev`. Vor dem Pushen: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` – dasselbe prüft die CI bei jedem Pull Request. Hinweise für Claude Code stehen in `CLAUDE.md`.

## Landingpage

Abgemeldete Besucher sehen unter `/` die öffentliche Landingpage (`src/components/landing/`) mit interaktiver Demo (nur Beispieldaten), Preisen und FAQ; angemeldete werden direkt zu `/meal-planner` weitergeleitet. Preise und FAQ stehen in `content.ts` und landen von dort auch in den strukturierten Daten für Google.

Während der Beta ist die App kostenlos; die Preiskarten zeigen die geplanten Preise und verweisen auf die Warteliste.

Für Canonical-URL, Sitemap, `robots.txt` und Vorschaubilder beim Build `NEXT_PUBLIC_SITE_URL` setzen (`https://tischleinplandich.de`).

## Anmelden per Link oder Code

Es gibt keine Passwörter mehr: `/auth/signin` schickt eine E-Mail mit Link und 6-stelligem Code (gleicher Knopf für neue Konten). Damit der Link in jedem Browser klappt und der Code in der Mail steht, im Supabase-Dashboard unter **Authentication → Emails → Templates** den Inhalt von `supabase/templates/sign-in.html` in **Magic Link** und **Confirm signup** eintragen (Betreff: „Dein Anmeldelink für Tischleinplandich“).

Für den Versand im Livebetrieb unter **Authentication → Emails → SMTP Settings** eigenes SMTP einrichten (Resend: Host `smtp.resend.com`, Port `465`, Benutzer `resend`, Passwort = API-Key mit „Sending access“) und unter **Authentication → Rate Limits** das Mail-Limit erhöhen. Der eingebaute Versand von Supabase schafft nur wenige Mails pro Stunde.

Unter **Authentication → URL Configuration** muss die **Site URL** die Adresse der App sein und `https://<deine-domain>/auth/callback` bei den Redirect URLs stehen. Bestehende Konten melden sich einfach mit ihrer E-Mail an.

## Rezepte teilen

Migration `011_recipe_sharing.sql` (im SQL Editor ausführen) fügt Teilen hinzu:

- **Link**: jedes Rezept bekommt beim ersten „Teilen“ einen geheimen Link `/r/<id>`, der ohne Konto nur dieses Rezept zeigt. „Link deaktivieren“ macht ihn ungültig.
- **Entdecken**: der Schalter „In Entdecken zeigen“ (`is_public`) listet das Rezept für alle angemeldeten Nutzer im Tab Rezepte → Entdecken. Dort und über den Link kann man eine Kopie in die eigenen Rezepte speichern.
- **Name**: steht als „Geteilt von …“ beim Rezept, wird im Profil gesetzt (`users.display_name`).

Ohne die Migration läuft die App weiter, nur Teilen, Entdecken und der Name zeigen einen Hinweis.

## Gemeinsam planen (Haushalte)

Migration `030_households.sql` (im SQL Editor ausführen) bringt Haushalte. Jedes Konto hat einen persönlichen Haushalt, in den die bisherigen Wochenpläne wandern. Unter Profil → „Haushalt“ legt man bis zu zwei gemeinsame Haushalte an (je höchstens 10 Leute) und lädt per Link (`/einladen/<token>`, 7 Tage gültig, jederzeit zurücksetzbar) ein. Alle planen dieselbe Woche, Änderungen kommen per Supabase Realtime sofort an, und der Tab „Haushalt“ zeigt die eigenen Rezepte zusammen mit denen der anderen, filterbar nach Person (fremde ohne Bewertungen, ändern nur als eigene Kopie). Gelöschte Rezepte, Rezepte von Leuten, die den Haushalt verlassen, und Rezepte gelöschter Konten bleiben im Plan mit Namen und Kalorien stehen. Entwurf und Entscheidungen: `docs/households.md`.

Ohne die Migration läuft die App wie bisher allein weiter; Profil → „Haushalt“ fehlt dann. Die Migration fügt `planned_meals` und `meal_plans` der Publikation `supabase_realtime` hinzu; falls Realtime im Projekt aus ist, aktualisiert sich der Plan beim Zurückkehren in die App.

Migration `031_household_shopping.sql` (danach ausführen) legt Einkaufsliste und Grundzutaten in den Haushalt: Haken, entfernte Artikel, weggelassene Rezepte, eigene Artikel, Zutaten „ohne Einplanen“, „Grundzutaten ausblenden“ und die Reihenfolge der Bereiche teilen alle Mitglieder live. Ohne Netz merkt sich die App Änderungen im Browser und schickt sie der Reihe nach, sobald sie wieder online ist. Beim ersten Start mit der Migration übernimmt jeder Browser einmal seine bisherige Liste (die letzten vier Wochen) in den persönlichen Haushalt. Ein neuer gemeinsamer Haushalt bekommt eine Kopie der Grundzutaten und Listeneinstellungen der Person, die ihn anlegt. Ohne Migration 031 bleibt die Liste wie bisher im Browser.

## Feedback lesen

Nutzer-Feedback (Profil → „Feedback senden“) landet in der Tabelle `feedback` (Migration `009_create_feedback.sql`). Nutzer können nur schreiben, nicht lesen. Lesen im Supabase-Dashboard → Table Editor → `feedback`, oder per SQL:

```sql
SELECT f.created_at, f.category, f.message, f.context, u.email
FROM feedback f LEFT JOIN users u ON u.id = f.user_id
WHERE f.status = 'new'
ORDER BY f.created_at DESC;
```

Erledigtes mit `UPDATE feedback SET status = 'done' WHERE id = '…';` markieren.

Automatisch: Eine geplante Claude-Code-Aufgabe (täglich, 5:47 Uhr) liest alle Einträge mit `status = 'new'`, fasst ähnliche zusammen und legt dafür GitHub-Issues mit dem Label `feedback` an – in eigenen Worten, ohne Zitate und ohne Angaben zur Person, weil das Repo öffentlich ist. Danach stehen die Einträge auf `seen`, mit Issue-Nummer und geschätzter Größe für die Belohnung (siehe „Premium für Feedback“). Verwalten unter claude.ai/code → Geplante Aufgaben.

## KI-Nutzung und Kosten

Rezept-Import, „Aus Idee“, „Mit KI ändern“ und „Neu berechnen“ im Editor laufen über Claude Haiku 5.5 mit niedrigem Aufwand (ca. 0,1–0,3 Cent pro Anfrage). Pro Nutzer und Tag sind 30 KI-Anfragen erlaubt (Migration `010_create_ai_usage.sql`, Grenze in `src/lib/server/recipe-ai.ts`). Solange die Migration fehlt, gilt kein Limit. PDFs dürfen höchstens 20 Seiten haben.

Im Profil steht unter „KI-Anfragen heute“, wie viele davon schon verbraucht sind (nur sichtbar, wenn die Migration läuft).

### Rezept-Details

Die KI schreibt die Zubereitung in eigenen Worten neu (zusammengehörige Handgriffe in einem Schritt), ordnet Zutaten in Gruppen und schätzt Nährwerte Zutat für Zutat; die App summiert sie pro Portion und markiert unplausible Werte. Gruppen stehen als Zeilen `# Für die Soße` im Zutatentext. Zeiten, Küchengeräte, Tipps, Allergene, Haltbarkeit, Suchwörter und pro Zutat bzw. Schritt Einkaufsabteilung, Nährwerte und Mengenanteile landen in `recipes.details` (geprüft mit `parseRecipeDetails` in `src/lib/recipe-details.ts`, Version in `DETAILS_VERSION`). Der gelesene Quelltext von Text- und Link-Importen wird privat in `recipe_sources` gespeichert, um Rezepte später neu aufbereiten zu können. Beides kommt mit Migration `028_recipe_details.sql` (im SQL Editor ausführen); ohne sie speichern Rezepte weiter, nur ohne Details und Quelltext.

Verbrauch pro Tag:

```sql
SELECT u.email, a.usage_date, a.request_count
FROM ai_usage a JOIN users u ON u.id = a.user_id
ORDER BY a.usage_date DESC, a.request_count DESC;
```

## Was ist neu?

Profil → „Was ist neu?“ liest die Tabelle `changelog` (Migration `013_create_changelog.sql`). Neue Einträge per SQL:

```sql
INSERT INTO changelog (title, description) VALUES ('Kurzer Titel', 'Ein Satz, was sich ändert.');
```

`released_on` ist standardmäßig heute. Neue Einträge zeigen im Profil ein „Neu“, bis die Seite geöffnet wurde.

## Premium für Feedback

Wer Feedback schickt, das umgesetzt wird, bekommt Premium-Tage gutgeschrieben (Migration `017_create_feedback_rewards.sql`, im SQL Editor ausführen). Die Bedingungen stehen unter `/feedback-belohnung` und sind im Feedback-Fenster verlinkt. Belohnt wird von Hand, sobald etwas live ist:

```sql
-- Wer hat es zuerst geschickt? (noch nicht belohnt, älteste zuerst)
SELECT f.id, f.created_at, f.category, f.message
FROM feedback f
LEFT JOIN feedback_rewards r ON r.feedback_id = f.id
WHERE r.id IS NULL AND f.user_id IS NOT NULL AND f.message ILIKE '%gemeinsam%'
ORDER BY f.created_at;

-- small = 1 Woche, medium = 2 Wochen, large = 1 Monat; Notiz optional
SELECT grant_feedback_reward('<feedback id>', 'large', 'Gemeinsame Rezepte');
```

Automatisch: Die tägliche Feedback-Triage (geplante Aufgabe in Claude Code, 5:47 Uhr) ordnet jedes Feedback einem GitHub-Issue zu und schätzt die Größe (`feedback.issue_number`, `feedback.reward_size`, Migration `018_feedback_triage_fields.sql`). Ist ein Feedback-Issue als erledigt geschlossen, schlägt sie die Belohnungen als Tabelle vor und vergibt sie erst, wenn du in der Sitzung zustimmst. `reward_size = 'none'` heißt: keine Belohnung. Ein Trigger setzt beim Einfügen `created_at` und leert die Triage-Felder, damit niemand „zuerst“ vortäuschen kann.

Pro Konto gibt es höchstens 90 Tage in zwölf Monaten (die letzte Belohnung wird gekürzt), jedes Feedback nur einmal. Die Funktion setzt das Feedback auf `done` und gibt die vergebenen Tage zurück. Beim nächsten Öffnen der App bekommt die Person einmalig ein Dankeschön, im Profil steht ihr „Premium-Guthaben“. Premium selbst gibt es noch nicht; die Tage sind eine Gutschrift für den Start.

## Bewertungen und Export

- **Bewertung**: Migration `012_add_recipe_rating.sql` (im SQL Editor ausführen) fügt `recipes.rating` (1–5 Sterne) hinzu. Bewertet wird in der Rezeptansicht; die Rezeptliste kann nach „Beste Bewertung“ sortieren. Ohne die Migration zeigt das Antippen der Sterne einen Hinweis.
- **Export**: Profil → „Rezepte exportieren“ lädt alle Rezepte als ZIP mit einer Markdown-Datei pro Rezept (plus Fotos in `images/`) herunter.

## Nährwerte ausblenden

Profil → Tagesziele → „Nährwerte anzeigen“ blendet Kalorien und Makros in der ganzen App aus (Planer, Wochenübersicht, Rezeptkarten und -ansicht). Gespeichert wird das in `user_preferences.show_nutrition` (Migration `014_add_show_nutrition.sql`, im SQL Editor ausführen). Ohne die Migration bleiben Nährwerte sichtbar und der Schalter zeigt einen Hinweis.

## Ausgewogenheit

Rezepte und Wochen bekommen einen Wert von 0 bis 100 (Profil → Tagesziele → „Ausgewogenheit anzeigen“). Die KI schätzt beim Import, bei „Aus Idee“ und „Mit KI ändern“ nur Fakten pro Portion (Zutatengruppen, Gramm, NOVA-Verarbeitungsgrad, Ballaststoffe, Zucker, Salz, gesättigte Fette); die Punkte rechnet `src/lib/balance.ts` nach festen Regeln aus. Die Regeln mit Quellen stehen öffentlich unter `/ausgewogenheit` und lesen ihre Grenzwerte aus derselben Datei. Alte, selbst getippte oder von Hand geänderte Rezepte haben (noch) keinen aktuellen Wert, bis man im Editor „Neu berechnen“ tippt (`/api/recipes/recalculate`, behält den Text und rechnet Nährwerte, Fakten und Details neu; Logik in `src/lib/recipe-recalculate.ts`); die Fakten lassen sich später gesammelt nachtragen (Format: `RecipeBalance` in `src/lib/balance.ts`, `fingerprint` per `balanceFingerprint`).

Gespeichert wird in `recipes.balance` und `user_preferences.show_balance` (Migration `022_recipe_balance.sql`, im SQL Editor ausführen). Ohne die Migration speichern Rezepte weiter (ohne Wert), der Schalter zeigt einen Hinweis. Damit Kopien aus „Entdecken“ und Teilen-Links ihren Wert behalten, liefern die Teilen-Funktionen die Fakten mit (Migration `025_shared_recipe_balance.sql`); ohne sie haben solche Kopien keinen Wert.

## Warteliste (Double-Opt-in)

Die Landingpage sammelt E-Mails für den Start (Migration `015_create_waitlist.sql`, im SQL Editor ausführen). Ablauf: Eintragen → Bestätigungsmail über Resend → Klick auf `/warteliste?token=…` und dort auf „Anmeldung bestätigen“ (ein Knopf statt direktem Link, damit Mail-Scanner nicht automatisch bestätigen). Jede Mail enthält einen Abmeldelink, der den Eintrag löscht. Unbestätigte Einträge werden nach 30 Tagen gelöscht.

Benötigt `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` und `WAITLIST_FROM_EMAIL` (Absenderdomain in Resend verifizieren). Bestätigte Adressen:

```sql
SELECT email, confirmed_at FROM waitlist WHERE confirmed_at IS NOT NULL ORDER BY confirmed_at;
```

## Konto löschen

Profil → „Konto löschen“ (unten) löscht Fotos im Storage und den Auth-Nutzer; alle Tabellen hängen per `ON DELETE CASCADE` daran. Braucht `SUPABASE_SERVICE_ROLE_KEY`.

## Impressum und Datenschutz

`/impressum` und `/datenschutz` lesen die Betreiberdaten aus `src/lib/legal.ts`. Alle `[PLATZHALTER]` vor dem Livegang ausfüllen und die Texte prüfen lassen. Kommt ein neuer Dienst dazu, die Datenschutzerklärung anpassen.

## Captcha (Cloudflare Turnstile)

Schützt Anmeldung und Warteliste vor Bots, die massenhaft Mails auslösen. Reihenfolge beachten, sonst klappt keine Anmeldung mehr:

1. Im Cloudflare-Dashboard unter **Turnstile** ein Widget anlegen (Domain eintragen, Modus „Managed“).
2. In Vercel `NEXT_PUBLIC_TURNSTILE_SITE_KEY` und `TURNSTILE_SECRET_KEY` setzen und neu deployen.
3. Erst danach in Supabase unter **Authentication → Attack Protection** „Enable CAPTCHA protection“ einschalten, Anbieter Turnstile, Secret Key eintragen.

Ohne die Schlüssel ist der Captcha aus und beide Formulare funktionieren wie bisher. Ist nur `NEXT_PUBLIC_TURNSTILE_SITE_KEY` gesetzt, lehnt die Warteliste jede Anmeldung ab, bis auch `TURNSTILE_SECRET_KEY` da ist.

## Grenzen für Inhalte

Migration `016_limit_user_content.sql` (im SQL Editor ausführen) setzt Grenzen, die die App selbst einhält, die Datenbank bisher aber nicht erzwang:

- **Fotos**: nur JPEG, PNG oder WebP, höchstens 5 MB (prüft Supabase Storage). Andere Formate wandelt die App vor dem Hochladen in JPEG um.
- **Links**: `source_url` nur `http(s)://`, `image_url` nur aus dem Bucket `recipe-images`. Die App zeigt zusätzlich nur Bilder aus dem eigenen Supabase-Projekt.
- **Längen**: Name 200, Zutaten und Schritte je 10.000 Zeichen, Tags 50; höchstens 2000 Rezepte pro Konto.

Migration `032_security_hardening.sql` (im SQL Editor ausführen) schließt Lücken aus einer Sicherheitsprüfung:

- **Eigene Nutzerzeile**: Über die API lässt sich nur noch der Anzeigename ändern, nicht mehr die E-Mail.
- **Haushalt**: Entfernt die Besitzerin jemanden, wird der Einladungslink ungültig.
- **Öffentliche Rezepte**: nur noch für Angemeldete lesbar; Teilen-Links funktionieren weiter ohne Konto.
- **Weitere Grenzen**: Grundzutat 100 Zeichen; je Haushalt höchstens 1000 Grundzutaten und 1000 Wochen, je Woche 300 Mahlzeiten, je Konto 1000 Tags und 20 Feedbacks pro Tag.
