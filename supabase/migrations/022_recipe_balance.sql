-- "Ausgewogenheit": facts the AI estimates per recipe (ingredient groups, grams,
-- processing, fibre, sugar, salt, saturated fat). The score itself is calculated
-- in the app from these (src/lib/balance.ts), so the formula can change without
-- touching stored data.
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS balance JSONB;

-- Written by the client, so only an object of bounded size is accepted. The app
-- validates the contents again on every read.
ALTER TABLE public.recipes DROP CONSTRAINT IF EXISTS recipes_balance_shape;
ALTER TABLE public.recipes ADD CONSTRAINT recipes_balance_shape
  CHECK (balance IS NULL OR (jsonb_typeof(balance) = 'object' AND pg_column_size(balance) <= 32768));

-- Whether the app shows the score (Profil → Tagesziele → "Ausgewogenheit anzeigen").
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS show_balance BOOLEAN NOT NULL DEFAULT TRUE;
