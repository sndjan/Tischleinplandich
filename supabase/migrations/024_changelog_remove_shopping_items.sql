-- Announce removing single items from the shopping list in "Was ist neu?"
-- (skipped if migration 013 hasn't run).
DO $$
BEGIN
  IF to_regclass('public.changelog') IS NOT NULL THEN
    INSERT INTO public.changelog (title, description)
    SELECT entry.title, entry.description
    FROM (VALUES
      ('Einzelne Zutaten streichen',
       'Hast du etwas schon zu Hause, tippe auf der Einkaufsliste auf das Kreuz daneben. Unter „Hast du schon“ holst du es wieder zurück.')
    ) AS entry(title, description)
    WHERE NOT EXISTS (SELECT 1 FROM public.changelog WHERE changelog.title = entry.title);
  END IF;
END;
$$;
