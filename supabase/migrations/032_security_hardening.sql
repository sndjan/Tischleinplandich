-- Closes gaps found in a security review: users could rewrite their own email
-- (and block someone else's sign-up with it), a removed household member could
-- rejoin with the old invite link, public recipes were readable without an
-- account, and several texts and row counts had no upper limit.

-- Own user row: only the display name ------------------------------------------

-- The policies allow a user to write their whole row, including email, which is
-- UNIQUE: taking someone's address made that person's sign-up fail in
-- handle_new_user. The app only ever writes display_name; everything else is
-- written by triggers and SECURITY DEFINER functions.
REVOKE INSERT, UPDATE ON public.users FROM anon, authenticated;
GRANT UPDATE (display_name) ON public.users TO authenticated;

-- Put back addresses that were changed that way. A row that can't be fixed yet
-- (its address is still held by another row) is skipped, not fatal.
DO $$
DECLARE
  v_user RECORD;
BEGIN
  FOR v_user IN
    SELECT u.id, a.email
    FROM public.users u
    JOIN auth.users a ON a.id = u.id
    WHERE a.email IS NOT NULL AND u.email IS DISTINCT FROM a.email
  LOOP
    BEGIN
      UPDATE public.users SET email = v_user.email WHERE id = v_user.id;
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'users.email of % left as is: address in use by another row', v_user.id;
    END;
  END LOOP;
END;
$$;

-- The sign-up trigger ran with search_path = public. The two triggers it sets
-- off inherited that and used unqualified names, so all three change together.
CREATE OR REPLACE FUNCTION public.create_user_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_preferences (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_health_targets()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.health_targets (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.create_user_preferences() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_health_targets() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Removing a member ends the invite link ------------------------------------------

-- Every member can read the link, so the removed person still had it and could
-- walk back in for up to 7 days. The next "Einladen" makes a new one.
CREATE OR REPLACE FUNCTION public.remove_household_member(p_household_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_household_owner(p_household_id) THEN
    RAISE EXCEPTION 'not_the_owner';
  END IF;
  IF p_user_id = (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'cannot_remove_self';
  END IF;

  DELETE FROM public.household_members WHERE household_id = p_household_id AND user_id = p_user_id;

  UPDATE public.households
  SET invite_token = NULL, invite_expires_at = NULL
  WHERE id = p_household_id;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_household_member(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_household_member(UUID, UUID) TO authenticated;

-- Public recipes: signed-in users only -------------------------------------------

-- The policy from migration 001 had no role, so anyone with the public API key
-- could list every public recipe with its owner's id. "Entdecken" is for
-- signed-in users, and share links go through get_shared_recipe.
DROP POLICY IF EXISTS "Users can view public recipes" ON public.recipes;
CREATE POLICY "Users can view public recipes"
  ON public.recipes FOR SELECT TO authenticated
  USING (is_public = true);

-- Links between rows must stay inside one account ---------------------------------

-- A recipe could be tagged with someone else's tag, and use someone else's food
-- item, whose ON DELETE RESTRICT then blocked that person's account deletion.
DROP POLICY IF EXISTS "Users can manage recipe_tags for recipes they own" ON public.recipe_tags;
CREATE POLICY "Users can manage recipe_tags for recipes they own"
  ON public.recipe_tags FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_tags.recipe_id AND r.user_id = (SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.tags t WHERE t.id = recipe_tags.tag_id AND t.user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Users can create recipe_ingredients for recipes they own" ON public.recipe_ingredients;
CREATE POLICY "Users can create recipe_ingredients for recipes they own"
  ON public.recipe_ingredients FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_ingredients.recipe_id AND r.user_id = (SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.food_items f WHERE f.id = recipe_ingredients.food_item_id AND f.user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Users can update recipe_ingredients for recipes they own" ON public.recipe_ingredients;
CREATE POLICY "Users can update recipe_ingredients for recipes they own"
  ON public.recipe_ingredients FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_ingredients.recipe_id AND r.user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_ingredients.recipe_id AND r.user_id = (SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.food_items f WHERE f.id = recipe_ingredients.food_item_id AND f.user_id = (SELECT auth.uid()))
  );

-- Text lengths -------------------------------------------------------------------

-- NOT VALID keeps any existing longer rows readable; new and changed rows must fit.
ALTER TABLE public.pantry_staples DROP CONSTRAINT IF EXISTS pantry_staples_name_length;
ALTER TABLE public.pantry_staples ADD CONSTRAINT pantry_staples_name_length
  CHECK (char_length(name) <= 100) NOT VALID;

ALTER TABLE public.feedback DROP CONSTRAINT IF EXISTS feedback_meta_lengths;
ALTER TABLE public.feedback ADD CONSTRAINT feedback_meta_lengths CHECK (
  (context IS NULL OR char_length(context) <= 1000)
  AND (user_agent IS NULL OR char_length(user_agent) <= 1000)
) NOT VALID;

-- At most 30 entries (migration 031), which are short section ids.
ALTER TABLE public.households DROP CONSTRAINT IF EXISTS households_section_order_size;
ALTER TABLE public.households ADD CONSTRAINT households_section_order_size
  CHECK (char_length(array_to_string(shopping_section_order, '')) <= 1500) NOT VALID;

-- Row counts ---------------------------------------------------------------------

-- Far above what the app needs; they only stop someone from filling the
-- database through the API. Recipes and shopping rows have their own limits
-- (migrations 016 and 031).
CREATE OR REPLACE FUNCTION public.enforce_row_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_over BOOLEAN;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'tags' THEN
      v_over := (SELECT count(*) FROM public.tags WHERE user_id = NEW.user_id) >= 1000;
    WHEN 'pantry_staples' THEN
      v_over := (SELECT count(*) FROM public.pantry_staples WHERE household_id = NEW.household_id) >= 1000;
    WHEN 'meal_plans' THEN
      v_over := (SELECT count(*) FROM public.meal_plans WHERE household_id = NEW.household_id) >= 1000;
    WHEN 'planned_meals' THEN
      v_over := (SELECT count(*) FROM public.planned_meals WHERE meal_plan_id = NEW.meal_plan_id) >= 300;
    WHEN 'feedback' THEN
      v_over := (
        SELECT count(*) FROM public.feedback
        WHERE user_id = NEW.user_id AND created_at > NOW() - INTERVAL '1 day'
      ) >= 20;
    ELSE
      v_over := false;
  END CASE;

  IF v_over THEN
    RAISE EXCEPTION 'row_limit_reached' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_row_limits() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tags_enforce_limit ON public.tags;
CREATE TRIGGER tags_enforce_limit
  BEFORE INSERT ON public.tags
  FOR EACH ROW EXECUTE FUNCTION public.enforce_row_limits();

-- Named to run after the triggers that fill in household_id (migrations 030, 031).
DROP TRIGGER IF EXISTS pantry_staples_enforce_limit ON public.pantry_staples;
CREATE TRIGGER pantry_staples_enforce_limit
  BEFORE INSERT ON public.pantry_staples
  FOR EACH ROW EXECUTE FUNCTION public.enforce_row_limits();

DROP TRIGGER IF EXISTS meal_plans_enforce_limit ON public.meal_plans;
CREATE TRIGGER meal_plans_enforce_limit
  BEFORE INSERT ON public.meal_plans
  FOR EACH ROW EXECUTE FUNCTION public.enforce_row_limits();

DROP TRIGGER IF EXISTS planned_meals_enforce_limit ON public.planned_meals;
CREATE TRIGGER planned_meals_enforce_limit
  BEFORE INSERT ON public.planned_meals
  FOR EACH ROW EXECUTE FUNCTION public.enforce_row_limits();

DROP TRIGGER IF EXISTS feedback_enforce_limit ON public.feedback;
CREATE TRIGGER feedback_enforce_limit
  BEFORE INSERT ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.enforce_row_limits();
