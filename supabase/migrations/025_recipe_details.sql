-- Richer AI recipes: equipment, tips, times, allergens, storage and search words,
-- plus per ingredient and step what the plain text can't say (src/lib/recipe-details.ts).
-- Ingredient groups need no column: they are "# Für die Soße" lines in the text.
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS details JSONB;

-- Written by the client, so only an object of bounded size is accepted. The app
-- validates the contents again on every read.
ALTER TABLE public.recipes DROP CONSTRAINT IF EXISTS recipes_details_shape;
ALTER TABLE public.recipes ADD CONSTRAINT recipes_details_shape
  CHECK (details IS NULL OR (jsonb_typeof(details) = 'object' AND pg_column_size(details) <= 32768));

-- What an import was read from (web page or pasted text), so a recipe can be
-- processed again when the AI improves. Separate from recipes because public
-- recipes are readable by everyone; this table is owner-only.
CREATE TABLE IF NOT EXISTS public.recipe_sources (
  recipe_id UUID PRIMARY KEY REFERENCES public.recipes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 20000),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipe_sources_user ON public.recipe_sources(user_id);

ALTER TABLE public.recipe_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own recipe_sources" ON public.recipe_sources;
CREATE POLICY "Users can view their own recipe_sources"
  ON public.recipe_sources FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Only for the user's own recipes, so nobody attaches text to someone else's.
DROP POLICY IF EXISTS "Users can create their own recipe_sources" ON public.recipe_sources;
CREATE POLICY "Users can create their own recipe_sources"
  ON public.recipe_sources FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete their own recipe_sources" ON public.recipe_sources;
CREATE POLICY "Users can delete their own recipe_sources"
  ON public.recipe_sources FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- No UPDATE policy: a source is written once with the recipe.

-- Announce it in "Was ist neu?" (skipped if migration 013 hasn't run).
DO $$
BEGIN
  IF to_regclass('public.changelog') IS NOT NULL THEN
    INSERT INTO public.changelog (title, description)
    SELECT entry.title, entry.description
    FROM (VALUES
      ('Bessere Rezepte per KI',
       'Beim Importieren fasst die KI die Schritte sinnvoll zusammen, ordnet Zutaten in Gruppen wie „Für die Soße“ und schätzt Zeit und Nährwerte Zutat für Zutat.'),
      ('Küchengeräte und Tipps',
       'Importierte Rezepte zeigen, welche Küchengeräte du brauchst, ein paar hilfreiche Tipps und mögliche Allergene. Im Kochmodus siehst du pro Schritt genau die Menge, die dran ist.')
    ) AS entry(title, description)
    WHERE NOT EXISTS (SELECT 1 FROM public.changelog WHERE changelog.title = entry.title);
  END IF;
END;
$$;
