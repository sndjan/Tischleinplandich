-- Announce the new desktop layout in "Was ist neu?" (skipped if migration 013 hasn't run).
DO $$
BEGIN
  IF to_regclass('public.changelog') IS NOT NULL THEN
    INSERT INTO public.changelog (title, description)
    SELECT 'Neues Layout am Computer',
           'Die ganze Woche steht jetzt in einer Zeile, Rezepte und Einkaufsliste wechselst du über die Leiste links. Rezepte und der KI-Import öffnen sich seitlich, dein Plan bleibt daneben sichtbar.'
    WHERE NOT EXISTS (SELECT 1 FROM public.changelog WHERE title = 'Neues Layout am Computer');
  END IF;
END;
$$;
