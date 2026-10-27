-- Sharing recipes: a secret link per recipe that works without an account, and
-- the "Entdecken" list of recipes other users made public. Shared recipes show
-- the owner's display name.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS display_name TEXT
  CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 1 AND 40);

-- Random, hard to guess id used in the share link (/r/<share_id>). NULL = no link.
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS share_id TEXT
  CHECK (share_id IS NULL OR share_id ~ '^[A-Za-z0-9_-]{8,32}$');

CREATE UNIQUE INDEX IF NOT EXISTS idx_recipes_share_id
  ON public.recipes (share_id)
  WHERE share_id IS NOT NULL;

-- Lets "Entdecken" sort the newest public recipes without scanning the table.
CREATE INDEX IF NOT EXISTS idx_recipes_public_created_at
  ON public.recipes (created_at DESC)
  WHERE is_public = true;

-- Recipe behind a share link, readable without an account. Returns NULL when the
-- link does not exist (or was turned off). user_id is left out on purpose.
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
