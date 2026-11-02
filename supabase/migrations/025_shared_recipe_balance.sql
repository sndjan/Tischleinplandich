-- Shared recipes also return their "Ausgewogenheit" facts, so a copy saved from a
-- share link or "Entdecken" keeps its score instead of starting without one.
-- Needs migration 022 (recipes.balance).

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
