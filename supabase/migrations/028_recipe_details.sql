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

-- Shared recipes also return their details, so a copy saved from a share link or
-- "Entdecken" keeps equipment, tips and allergens. Same as migration 025 otherwise.
CREATE OR REPLACE FUNCTION public.get_shared_recipe(p_share_id TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'id', r.id,
    'share_id', r.share_id,
    'name', r.name,
    'ingredients', r.ingredients,
    'preparation_steps', r.preparation_steps,
    'source_url', r.source_url,
    'prep_time', r.prep_time,
    'calories', r.calories,
    'protein', r.protein,
    'carbs', r.carbs,
    'fats', r.fats,
    'serving_size', r.serving_size,
    'image_url', r.image_url,
    'balance', r.balance,
    'details', r.details,
    'author_name', u.display_name,
    'tags', COALESCE((
      SELECT jsonb_agg(t.name ORDER BY t.name)
      FROM public.recipe_tags rt
      JOIN public.tags t ON t.id = rt.tag_id
      WHERE rt.recipe_id = r.id
    ), '[]'::jsonb)
  )
  FROM public.recipes r
  JOIN public.users u ON u.id = r.user_id
  WHERE r.share_id = p_share_id;
$$;

REVOKE ALL ON FUNCTION public.get_shared_recipe(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_recipe(TEXT) TO anon, authenticated;

-- Public recipes of other users for "Entdecken", newest first, with the author's
-- display name. Signed-in users only.
CREATE OR REPLACE FUNCTION public.discover_recipes(p_search TEXT DEFAULT NULL, p_limit INTEGER DEFAULT 60)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(jsonb_agg(item ORDER BY created_at DESC), '[]'::jsonb)
  FROM (
    SELECT
      r.created_at,
      jsonb_build_object(
        'id', r.id,
        'name', r.name,
        'ingredients', r.ingredients,
        'preparation_steps', r.preparation_steps,
        'source_url', r.source_url,
        'prep_time', r.prep_time,
        'calories', r.calories,
        'protein', r.protein,
        'carbs', r.carbs,
        'fats', r.fats,
        'serving_size', r.serving_size,
        'image_url', r.image_url,
        'balance', r.balance,
        'details', r.details,
        'created_at', r.created_at,
        'author_name', u.display_name,
        'tags', COALESCE((
          SELECT jsonb_agg(t.name ORDER BY t.name)
          FROM public.recipe_tags rt
          JOIN public.tags t ON t.id = rt.tag_id
          WHERE rt.recipe_id = r.id
        ), '[]'::jsonb)
      ) AS item
    FROM public.recipes r
    JOIN public.users u ON u.id = r.user_id
    WHERE r.is_public = true
      AND r.user_id <> (SELECT auth.uid())
      AND (
        p_search IS NULL
        OR p_search = ''
        OR r.name ILIKE '%' || p_search || '%'
        OR r.ingredients ILIKE '%' || p_search || '%'
      )
    ORDER BY r.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 60), 1), 200)
  ) found;
$$;

REVOKE ALL ON FUNCTION public.discover_recipes(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.discover_recipes(TEXT, INTEGER) TO authenticated;

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

-- "Details neu berechnen" in the recipe editor (no schema change of its own).
DO $$
BEGIN
  IF to_regclass('public.changelog') IS NOT NULL THEN
    INSERT INTO public.changelog (title, description)
    SELECT entry.title, entry.description
    FROM (VALUES
      ('Nährwerte neu berechnen',
       'Hast du ein Rezept selbst geändert, tippe beim Bearbeiten unter den Nährwerten auf „Neu berechnen“. Die KI schätzt Nährwerte, Ausgewogenheit, Zeit und Details für deine Version neu, dein Text bleibt, wie er ist.')
    ) AS entry(title, description)
    WHERE NOT EXISTS (SELECT 1 FROM public.changelog WHERE changelog.title = entry.title);
  END IF;
END;
$$;
