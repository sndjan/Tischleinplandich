-- Whether the app shows calories and macros at all (Profil → Tagesziele → "Nährwerte anzeigen").
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS show_nutrition BOOLEAN NOT NULL DEFAULT TRUE;
