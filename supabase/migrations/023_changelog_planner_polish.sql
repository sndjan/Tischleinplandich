-- Announce the smaller planner changes in "Was ist neu?" (skipped if migration
-- 013 hasn't run).
DO $$
BEGIN
  IF to_regclass('public.changelog') IS NOT NULL THEN
    INSERT INTO public.changelog (title, description)
    SELECT entry.title, entry.description
    FROM (VALUES
      ('Vergangene Tage treten zurück',
       'Im Wochenplan sind vergangene Tage leicht grau, damit heute und die kommenden Tage hervorstechen.'),
      ('Kalorien der ganzen Woche',
       'Die Wochenübersicht zeigt neben dem Tagesschnitt jetzt auch, wie viele Kalorien die Woche insgesamt hat.'),
      ('Alle Tags beim Einplanen',
       'Beim Auswählen eines Rezepts brechen die Tags in neue Zeilen um, statt seitlich aus dem Bild zu laufen. Viele Tags klappst du mit „weitere“ auf.')
    ) AS entry(title, description)
    WHERE NOT EXISTS (SELECT 1 FROM public.changelog WHERE changelog.title = entry.title);
  END IF;
END;
$$;
