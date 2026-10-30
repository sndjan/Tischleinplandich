-- Announce swiping through weeks in the day strip in "Was ist neu?" (skipped
-- if migration 013 hasn't run).
DO $$
BEGIN
  IF to_regclass('public.changelog') IS NOT NULL THEN
    INSERT INTO public.changelog (title, description)
    SELECT entry.title, entry.description
    FROM (VALUES
      ('Durch die Wochen wischen',
       'In der Tagesansicht wischst du die Tagesleiste nach links oder rechts, um zur nächsten oder letzten Woche zu springen.')
    ) AS entry(title, description)
    WHERE NOT EXISTS (SELECT 1 FROM public.changelog WHERE changelog.title = entry.title);
  END IF;
END;
$$;
