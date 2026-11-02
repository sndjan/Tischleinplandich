-- Announce the score on recipe covers and in "Entdecken" in "Was ist neu?"
-- (skipped if migration 013 hasn't run).
DO $$
BEGIN
  IF to_regclass('public.changelog') IS NOT NULL THEN
    INSERT INTO public.changelog (title, description)
    SELECT entry.title, entry.description
    FROM (VALUES
      ('Ausgewogenheit auf einen Blick',
       'Neben der Zeit steht jetzt auch die Ausgewogenheit direkt auf dem Rezeptbild – bei deinen Rezepten und in „Entdecken“. Gespeicherte Rezepte aus „Entdecken“ behalten ihren Wert.')
    ) AS entry(title, description)
    WHERE NOT EXISTS (SELECT 1 FROM public.changelog WHERE changelog.title = entry.title);
  END IF;
END;
$$;
