-- Limits for user content that the app UI already respects but the API did not
-- enforce: anyone can write to Supabase directly with their own session.

-- Storage: only images, at most 5 MB each (Storage rejects anything else).
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'recipe-images';

-- Source links must be plain http(s) URLs; javascript: links would run code in
-- the session of whoever clicks them on a shared recipe. Clear old bad rows first.
UPDATE public.recipes SET source_url = NULL WHERE source_url IS NOT NULL AND source_url !~* '^https?://';
ALTER TABLE public.recipes DROP CONSTRAINT IF EXISTS recipes_source_url_http;
ALTER TABLE public.recipes ADD CONSTRAINT recipes_source_url_http
  CHECK (source_url IS NULL OR (source_url ~* '^https?://' AND char_length(source_url) <= 2000));

-- Covers must come from a recipe-images bucket on Supabase. The app additionally
-- checks that the host is our own project (src/lib/safe-links.ts).
UPDATE public.recipes SET image_url = NULL
WHERE image_url IS NOT NULL
  AND image_url !~ '^https://[^/]+/storage/v1/object/public/recipe-images/';
ALTER TABLE public.recipes DROP CONSTRAINT IF EXISTS recipes_image_url_storage;
ALTER TABLE public.recipes ADD CONSTRAINT recipes_image_url_storage
  CHECK (image_url IS NULL OR (image_url ~ '^https://[^/]+/storage/v1/object/public/recipe-images/' AND char_length(image_url) <= 1000));

-- Text lengths. NOT VALID keeps any existing longer rows readable; new and changed
-- rows must fit.
ALTER TABLE public.recipes DROP CONSTRAINT IF EXISTS recipes_text_lengths;
ALTER TABLE public.recipes ADD CONSTRAINT recipes_text_lengths CHECK (
  char_length(name) <= 200
  AND char_length(ingredients) <= 10000
  AND (preparation_steps IS NULL OR char_length(preparation_steps) <= 10000)
  AND (prep_time IS NULL OR char_length(prep_time) <= 100)
) NOT VALID;

ALTER TABLE public.tags DROP CONSTRAINT IF EXISTS tags_name_length;
ALTER TABLE public.tags ADD CONSTRAINT tags_name_length CHECK (char_length(name) <= 50) NOT VALID;

-- At most 2000 recipes per user.
CREATE OR REPLACE FUNCTION public.enforce_recipe_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT count(*) FROM public.recipes WHERE user_id = NEW.user_id) >= 2000 THEN
    RAISE EXCEPTION 'recipe_limit_reached' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_recipe_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS recipes_enforce_limit ON public.recipes;
CREATE TRIGGER recipes_enforce_limit
  BEFORE INSERT ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_recipe_limit();
