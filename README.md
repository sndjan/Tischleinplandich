# Weekly-Meal-Planner

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

- Wochenpläne teilen und gemeinsam bearbeiten (z. B. mit der Familie)
- Drag & Drop: Rezept halten, Tage erscheinen, auf einen Tag ziehen

## Landingpage

Abgemeldete Besucher sehen unter `/` die öffentliche Landingpage (`src/components/landing/`) mit interaktiver Demo (nur Beispieldaten), Preisen und FAQ; angemeldete werden direkt zu `/meal-planner` weitergeleitet. Preise und FAQ stehen in `content.ts` und landen von dort auch in den strukturierten Daten für Google.

Für Canonical-URL, Sitemap, `robots.txt` und Vorschaubilder beim Build `NEXT_PUBLIC_SITE_URL` setzen (z. B. `https://deine-domain.de`).

## Anmelden per Link oder Code

Es gibt keine Passwörter mehr: `/auth/signin` schickt eine E-Mail mit Link und 6-stelligem Code (gleicher Knopf für neue Konten). Damit der Link in jedem Browser klappt und der Code in der Mail steht, im Supabase-Dashboard unter **Authentication → Email Templates → Magic Link** diese Vorlage eintragen:

```html
<h2>Dein Anmeldelink</h2>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email">Jetzt anmelden</a></p>
<p>Oder diesen Code in der App eingeben: <strong>{{ .Token }}</strong></p>
```

Unter **Authentication → URL Configuration** muss die **Site URL** die Adresse der App sein und `https://<deine-domain>/auth/callback` bei den Redirect URLs stehen. Bestehende Konten melden sich einfach mit ihrer E-Mail an.

## Rezepte teilen

Migration `011_recipe_sharing.sql` (im SQL Editor ausführen) fügt Teilen hinzu:

- **Link**: jedes Rezept bekommt beim ersten „Teilen“ einen geheimen Link `/r/<id>`, der ohne Konto nur dieses Rezept zeigt. „Link deaktivieren“ macht ihn ungültig.
- **Entdecken**: der Schalter „In Entdecken zeigen“ (`is_public`) listet das Rezept für alle angemeldeten Nutzer im Tab Rezepte → Entdecken. Dort und über den Link kann man eine Kopie in die eigenen Rezepte speichern.
- **Name**: steht als „Geteilt von …“ beim Rezept, wird im Profil gesetzt (`users.display_name`).

Ohne die Migration läuft die App weiter, nur Teilen, Entdecken und der Name zeigen einen Hinweis.

## Feedback lesen

Nutzer-Feedback (Profil → „Feedback senden“) landet in der Tabelle `feedback` (Migration `009_create_feedback.sql`). Nutzer können nur schreiben, nicht lesen. Lesen im Supabase-Dashboard → Table Editor → `feedback`, oder per SQL:

```sql
SELECT f.created_at, f.category, f.message, f.context, u.email
FROM feedback f LEFT JOIN users u ON u.id = f.user_id
WHERE f.status = 'new'
ORDER BY f.created_at DESC;
```

Erledigtes mit `UPDATE feedback SET status = 'done' WHERE id = '…';` markieren.

## KI-Nutzung und Kosten

Rezept-Import, „Aus Idee“ und „Mit KI ändern“ laufen über Claude Haiku 5.5 mit niedrigem Aufwand (ca. 0,1–0,3 Cent pro Anfrage). Pro Nutzer und Tag sind 30 KI-Anfragen erlaubt (Migration `010_create_ai_usage.sql`, Grenze in `src/lib/server/recipe-ai.ts`). Solange die Migration fehlt, gilt kein Limit. PDFs dürfen höchstens 20 Seiten haben.

Im Profil steht unter „KI-Anfragen heute“, wie viele davon schon verbraucht sind (nur sichtbar, wenn die Migration läuft).

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

## Bewertungen und Export

- **Bewertung**: Migration `012_add_recipe_rating.sql` (im SQL Editor ausführen) fügt `recipes.rating` (1–5 Sterne) hinzu. Bewertet wird in der Rezeptansicht; die Rezeptliste kann nach „Beste Bewertung“ sortieren. Ohne die Migration zeigt das Antippen der Sterne einen Hinweis.
- **Export**: Profil → „Rezepte exportieren“ lädt alle Rezepte als ZIP mit einer Markdown-Datei pro Rezept (plus Fotos in `images/`) herunter.
