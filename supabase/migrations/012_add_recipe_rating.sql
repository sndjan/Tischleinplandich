-- Personal 1–5 star rating of a recipe (null = not rated yet), for sorting the library.
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS rating SMALLINT CHECK (rating BETWEEN 1 AND 5);
