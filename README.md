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
