-- Announce week switching, the shopping list changes and the smaller additions
-- in "Was ist neu?" (skipped if migration 013 hasn't run).
DO $$
BEGIN
  IF to_regclass('public.changelog') IS NOT NULL THEN
    INSERT INTO public.changelog (title, description)
    SELECT entry.title, entry.description
    FROM (VALUES
      ('Nächste Woche planen',
       'Mit den Pfeilen über dem Plan springst du zur nächsten oder letzten Woche. Einkaufsliste und Einplanen folgen der gewählten Woche.'),
      ('Einkaufsliste nach deinen Wünschen',
       'Rezepte lassen sich für diesen Einkauf ausblenden, eigene Artikel bekommen eine Menge, und die Bereiche sortierst du so, wie dein Laden aufgebaut ist. Aus jedem Rezept kommen Zutaten auch ohne Einplanen auf die Liste.'),
      ('Auswärts essen',
       'Trag ein Essen ohne Rezept ein, auf Wunsch mit geschätzten Kalorien, damit dein Tag trotzdem stimmt.'),
      ('Rezepte als PDF',
       'Unter Profil → Rezepte exportieren gibt es jetzt auch ein PDF mit einem Rezept pro Seite. Rezepte ohne Foto bekommen ein buntes Platzhalterbild.')
    ) AS entry(title, description)
    WHERE NOT EXISTS (SELECT 1 FROM public.changelog WHERE changelog.title = entry.title);
  END IF;
END;
$$;
