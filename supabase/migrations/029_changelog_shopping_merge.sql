-- Announce the tidier shopping list in "Was ist neu?"
-- (skipped if migration 013 hasn't run).
DO $$
BEGIN
  IF to_regclass('public.changelog') IS NOT NULL THEN
    INSERT INTO public.changelog (title, description)
    SELECT entry.title, entry.description
    FROM (VALUES
      ('Weniger doppelte Zutaten',
       '„Zwiebel“ und „Zwiebeln“ oder „Petersilie (frisch)“ und „Petersilie“ stehen auf der Einkaufsliste jetzt in einer Zeile. Mengen, die sich nicht umrechnen lassen, siehst du zusammen, z. B. „2 + 100 g“.')
    ) AS entry(title, description)
    WHERE NOT EXISTS (SELECT 1 FROM public.changelog WHERE changelog.title = entry.title);
  END IF;
END;
$$;
