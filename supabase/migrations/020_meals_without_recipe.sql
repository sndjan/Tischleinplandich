-- Meals that aren't a recipe, e.g. eating out: a short label and, optionally,
-- calories entered by hand, so the day's totals still add up.
ALTER TABLE public.planned_meals ALTER COLUMN recipe_id DROP NOT NULL;
ALTER TABLE public.planned_meals ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE public.planned_meals ADD COLUMN IF NOT EXISTS calories NUMERIC;

ALTER TABLE public.planned_meals DROP CONSTRAINT IF EXISTS planned_meals_recipe_or_label_check;
ALTER TABLE public.planned_meals ADD CONSTRAINT planned_meals_recipe_or_label_check
  CHECK (recipe_id IS NOT NULL OR char_length(btrim(label)) BETWEEN 1 AND 80);

ALTER TABLE public.planned_meals DROP CONSTRAINT IF EXISTS planned_meals_calories_check;
ALTER TABLE public.planned_meals ADD CONSTRAINT planned_meals_calories_check
  CHECK (calories IS NULL OR calories BETWEEN 0 AND 10000);
