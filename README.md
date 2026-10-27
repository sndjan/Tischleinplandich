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

## Feedback lesen

Nutzer-Feedback (Button 💬 oben rechts) landet in der Tabelle `feedback` (Migration `009_create_feedback.sql`). Nutzer können nur schreiben, nicht lesen. Lesen im Supabase-Dashboard → Table Editor → `feedback`, oder per SQL:

```sql
SELECT f.created_at, f.category, f.message, f.context, u.email
FROM feedback f LEFT JOIN users u ON u.id = f.user_id
WHERE f.status = 'new'
ORDER BY f.created_at DESC;
```

Erledigtes mit `UPDATE feedback SET status = 'done' WHERE id = '…';` markieren.

## KI-Nutzung und Kosten

Rezept-Import, „Aus Idee“ und „Mit KI ändern“ laufen über Claude Haiku 5.5 mit niedrigem Aufwand (ca. 0,1–0,3 Cent pro Anfrage). Pro Nutzer und Tag sind 30 KI-Anfragen erlaubt (Migration `010_create_ai_usage.sql`, Grenze in `src/lib/server/recipe-ai.ts`). Solange die Migration fehlt, gilt kein Limit. PDFs dürfen höchstens 20 Seiten haben.

Verbrauch pro Tag:

```sql
SELECT u.email, a.usage_date, a.request_count
FROM ai_usage a JOIN users u ON u.id = a.user_id
ORDER BY a.usage_date DESC, a.request_count DESC;
```
