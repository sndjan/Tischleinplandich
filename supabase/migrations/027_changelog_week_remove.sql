-- Announce removing meals straight from the week view in "Was ist neu?"
-- (skipped if migration 013 hasn't run).
DO $$
BEGIN
  IF to_regclass('public.changelog') IS NOT NULL THEN
    INSERT INTO public.changelog (title, description)
    SELECT entry.title, entry.description
    FROM (VALUES
      ('Entfernen in der Wochenansicht',
       'Jede Mahlzeit in der Wochenansicht hat jetzt ein Kreuz zum Entfernen. Und entfernst du mehrere Dinge hintereinander, siehst du nur noch einen „Rückgängig“-Hinweis statt einen ganzen Stapel.')
    ) AS entry(title, description)
    WHERE NOT EXISTS (SELECT 1 FROM public.changelog WHERE changelog.title = entry.title);
  END IF;
END;
$$;
