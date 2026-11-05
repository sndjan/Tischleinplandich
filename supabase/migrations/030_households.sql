-- Households: planning together. Every user gets a personal household that holds
-- their existing plans; shared households are created separately and joined by
-- invite link. Meal plans now belong to a household instead of a user. Design
-- notes in docs/households.md.

-- Tables ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Null for personal households, which the app calls "Persönlich".
  name TEXT CHECK (name IS NULL OR char_length(btrim(name)) BETWEEN 1 AND 40),
  -- Set for the one personal household of a user; it can never get members.
  personal_for UUID UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  -- People to plan for; null means the member count.
  default_servings NUMERIC CHECK (default_servings IS NULL OR default_servings BETWEEN 0.5 AND 20),
  -- Secret of the invite link (/einladen/<token>); one per household, reset by any member.
  invite_token TEXT UNIQUE CHECK (invite_token IS NULL OR invite_token ~ '^[A-Za-z0-9_-]{16,64}$'),
  invite_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT households_named_or_personal CHECK (personal_for IS NOT NULL OR name IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.household_members (
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (household_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_household_members_user_id ON public.household_members(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_household_members_one_owner
  ON public.household_members(household_id)
  WHERE role = 'owner';

-- The household the app shows, kept per account so all devices agree. Null or a
-- household the user left means the personal one.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS active_household_id UUID REFERENCES public.households(id) ON DELETE SET NULL;

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

-- Helpers used by policies ---------------------------------------------------

-- SECURITY DEFINER so policies on household_members can use it without
-- recursing into their own policy.
CREATE OR REPLACE FUNCTION public.is_household_member(p_household_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = p_household_id AND user_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.is_household_member(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_household_member(UUID) TO authenticated;

-- Personal households --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ensure_personal_household(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM public.households WHERE personal_for = p_user_id;

  IF v_id IS NULL THEN
    INSERT INTO public.households (personal_for)
    VALUES (p_user_id)
    ON CONFLICT (personal_for) DO NOTHING
    RETURNING id INTO v_id;

    -- Created by a concurrent call in the meantime.
    IF v_id IS NULL THEN
      SELECT id INTO v_id FROM public.households WHERE personal_for = p_user_id;
    END IF;
  END IF;

  INSERT INTO public.household_members (household_id, user_id, role)
  VALUES (v_id, p_user_id, 'owner')
  ON CONFLICT (household_id, user_id) DO NOTHING;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_personal_household(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_personal_household()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.ensure_personal_household(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.create_personal_household() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS create_personal_household_trigger ON public.users;
CREATE TRIGGER create_personal_household_trigger
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.create_personal_household();

SELECT public.ensure_personal_household(id) FROM public.users;

-- Meal plans belong to a household -------------------------------------------

ALTER TABLE public.meal_plans
  ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households(id) ON DELETE CASCADE;

UPDATE public.meal_plans mp
SET household_id = h.id
FROM public.households h
WHERE mp.household_id IS NULL AND h.personal_for = mp.user_id;

ALTER TABLE public.meal_plans ALTER COLUMN household_id SET NOT NULL;

-- One plan per household and week instead of per user and week. user_id now only
-- says who created it, and a shared plan must outlive its creator's account.
DO $$
DECLARE
  v_constraint RECORD;
BEGIN
  FOR v_constraint IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.meal_plans'::regclass
      AND (
        (c.contype = 'u' AND c.conkey::int2[] @> ARRAY[
          (SELECT attnum FROM pg_attribute WHERE attrelid = c.conrelid AND attname = 'user_id'),
          (SELECT attnum FROM pg_attribute WHERE attrelid = c.conrelid AND attname = 'week_start_date')
        ]::int2[])
        OR (c.contype = 'f' AND c.confrelid = 'public.users'::regclass)
      )
  LOOP
    EXECUTE format('ALTER TABLE public.meal_plans DROP CONSTRAINT %I', v_constraint.conname);
  END LOOP;
END;
$$;

ALTER TABLE public.meal_plans ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.meal_plans DROP CONSTRAINT IF EXISTS meal_plans_user_id_fkey;
ALTER TABLE public.meal_plans ADD CONSTRAINT meal_plans_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_meal_plans_household_week
  ON public.meal_plans(household_id, week_start_date);

-- App versions from before this migration create plans without a household;
-- those go to the personal one, where their plans always were.
CREATE OR REPLACE FUNCTION public.default_meal_plan_household()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.household_id IS NULL THEN
    NEW.household_id := public.ensure_personal_household(COALESCE(NEW.user_id, (SELECT auth.uid())));
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.default_meal_plan_household() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS meal_plans_default_household ON public.meal_plans;
CREATE TRIGGER meal_plans_default_household
  BEFORE INSERT ON public.meal_plans
  FOR EACH ROW EXECUTE FUNCTION public.default_meal_plan_household();

-- Policies -------------------------------------------------------------------

-- A plan may hold the user's own recipes and those of the household's members.
CREATE OR REPLACE FUNCTION public.can_plan_recipe(p_meal_plan_id UUID, p_recipe_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.recipes r
    JOIN public.meal_plans mp ON mp.id = p_meal_plan_id
    WHERE r.id = p_recipe_id
      AND (
        r.user_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.household_members m
          WHERE m.household_id = mp.household_id AND m.user_id = r.user_id
        )
      )
  );
$$;

-- Households and memberships are only written by the functions below, so there
-- are deliberately no INSERT, UPDATE or DELETE policies on them.
DROP POLICY IF EXISTS "Members can view their households" ON public.households;
CREATE POLICY "Members can view their households"
  ON public.households FOR SELECT TO authenticated
  USING (public.is_household_member(id));

DROP POLICY IF EXISTS "Members can view their household's members" ON public.household_members;
CREATE POLICY "Members can view their household's members"
  ON public.household_members FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

DROP POLICY IF EXISTS "Users can view their own meal_plans" ON public.meal_plans;
DROP POLICY IF EXISTS "Users can create meal_plans" ON public.meal_plans;
DROP POLICY IF EXISTS "Users can update their own meal_plans" ON public.meal_plans;
DROP POLICY IF EXISTS "Users can delete their own meal_plans" ON public.meal_plans;

DROP POLICY IF EXISTS "Members can view their household's meal_plans" ON public.meal_plans;
CREATE POLICY "Members can view their household's meal_plans"
  ON public.meal_plans FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

DROP POLICY IF EXISTS "Members can create meal_plans" ON public.meal_plans;
CREATE POLICY "Members can create meal_plans"
  ON public.meal_plans FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member(household_id) AND user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Members can update their household's meal_plans" ON public.meal_plans;
CREATE POLICY "Members can update their household's meal_plans"
  ON public.meal_plans FOR UPDATE TO authenticated
  USING (public.is_household_member(household_id))
  WITH CHECK (public.is_household_member(household_id));

DROP POLICY IF EXISTS "Members can delete their household's meal_plans" ON public.meal_plans;
CREATE POLICY "Members can delete their household's meal_plans"
  ON public.meal_plans FOR DELETE TO authenticated
  USING (public.is_household_member(household_id));

DROP POLICY IF EXISTS "Users can view planned_meals for their meal_plans" ON public.planned_meals;
DROP POLICY IF EXISTS "Users can create planned_meals for their meal_plans" ON public.planned_meals;
DROP POLICY IF EXISTS "Users can update planned_meals for their meal_plans" ON public.planned_meals;
DROP POLICY IF EXISTS "Users can delete planned_meals for their meal_plans" ON public.planned_meals;

DROP POLICY IF EXISTS "Members can view planned_meals" ON public.planned_meals;
CREATE POLICY "Members can view planned_meals"
  ON public.planned_meals FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.meal_plans mp
    WHERE mp.id = planned_meals.meal_plan_id AND public.is_household_member(mp.household_id)
  ));

DROP POLICY IF EXISTS "Members can create planned_meals" ON public.planned_meals;
CREATE POLICY "Members can create planned_meals"
  ON public.planned_meals FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meal_plans mp
      WHERE mp.id = planned_meals.meal_plan_id AND public.is_household_member(mp.household_id)
    )
    AND (recipe_id IS NULL OR public.can_plan_recipe(meal_plan_id, recipe_id))
  );

DROP POLICY IF EXISTS "Members can update planned_meals" ON public.planned_meals;
CREATE POLICY "Members can update planned_meals"
  ON public.planned_meals FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.meal_plans mp
    WHERE mp.id = planned_meals.meal_plan_id AND public.is_household_member(mp.household_id)
  ))
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meal_plans mp
      WHERE mp.id = planned_meals.meal_plan_id AND public.is_household_member(mp.household_id)
    )
    AND (recipe_id IS NULL OR public.can_plan_recipe(meal_plan_id, recipe_id))
  );

DROP POLICY IF EXISTS "Members can delete planned_meals" ON public.planned_meals;
CREATE POLICY "Members can delete planned_meals"
  ON public.planned_meals FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.meal_plans mp
    WHERE mp.id = planned_meals.meal_plan_id AND public.is_household_member(mp.household_id)
  ));

REVOKE ALL ON FUNCTION public.can_plan_recipe(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_plan_recipe(UUID, UUID) TO authenticated;

-- Recipes leaving a plan -----------------------------------------------------

-- A deleted recipe used to take its planned meals with it. Now they stay as
-- meals without a recipe, with the name and calories per portion, so other
-- members' weeks (and past weeks) don't lose them.
CREATE OR REPLACE FUNCTION public.detach_deleted_recipe()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.planned_meals
  SET recipe_id = NULL,
      label = COALESCE(NULLIF(btrim(left(btrim(OLD.name), 80)), ''), 'Rezept'),
      calories = CASE WHEN OLD.calories BETWEEN 0 AND 10000 THEN OLD.calories END
  WHERE recipe_id = OLD.id;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.detach_deleted_recipe() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS recipes_detach_planned_meals ON public.recipes;
CREATE TRIGGER recipes_detach_planned_meals
  BEFORE DELETE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.detach_deleted_recipe();

-- Someone leaves (or is removed, or deletes their account): their recipes in the
-- household's plans become meals without a recipe, the longest-standing member
-- takes over as owner, and a household nobody is left in is deleted.
CREATE OR REPLACE FUNCTION public.handle_household_member_removed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- The whole household is being deleted; nothing to hand over.
  IF NOT EXISTS (SELECT 1 FROM public.households WHERE id = OLD.household_id) THEN
    RETURN OLD;
  END IF;

  UPDATE public.planned_meals pm
  SET recipe_id = NULL,
      label = COALESCE(NULLIF(btrim(left(btrim(r.name), 80)), ''), 'Rezept'),
      calories = CASE WHEN r.calories BETWEEN 0 AND 10000 THEN r.calories END
  FROM public.meal_plans mp, public.recipes r
  WHERE pm.meal_plan_id = mp.id
    AND mp.household_id = OLD.household_id
    AND r.id = pm.recipe_id
    AND r.user_id = OLD.user_id;

  UPDATE public.users
  SET active_household_id = NULL
  WHERE id = OLD.user_id AND active_household_id = OLD.household_id;

  IF NOT EXISTS (SELECT 1 FROM public.household_members WHERE household_id = OLD.household_id) THEN
    DELETE FROM public.households WHERE id = OLD.household_id;
  ELSIF OLD.role = 'owner' THEN
    UPDATE public.household_members
    SET role = 'owner'
    WHERE household_id = OLD.household_id
      AND user_id = (
        SELECT user_id FROM public.household_members
        WHERE household_id = OLD.household_id
        ORDER BY joined_at, user_id
        LIMIT 1
      );
  END IF;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_household_member_removed() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS household_members_removed ON public.household_members;
CREATE TRIGGER household_members_removed
  AFTER DELETE ON public.household_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_household_member_removed();

-- Functions the app calls ----------------------------------------------------

-- The user's households with their members (display names only), plus which
-- one is active. Also creates the personal household if it is missing.
CREATE OR REPLACE FUNCTION public.get_my_households()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_signed_in';
  END IF;

  PERFORM public.ensure_personal_household(v_user_id);

  SELECT jsonb_build_object(
    'active_household_id', (SELECT active_household_id FROM public.users WHERE id = v_user_id),
    'households', COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', h.id,
        'name', h.name,
        'is_personal', h.personal_for IS NOT NULL,
        'role', me.role,
        'default_servings', h.default_servings,
        'members', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'user_id', m.user_id,
              'display_name', u.display_name,
              'role', m.role,
              'joined_at', m.joined_at
            )
            ORDER BY m.joined_at, m.user_id
          )
          FROM public.household_members m
          JOIN public.users u ON u.id = m.user_id
          WHERE m.household_id = h.id
        )
      )
      ORDER BY h.personal_for IS NULL, me.joined_at
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM public.household_members me
  JOIN public.households h ON h.id = me.household_id
  WHERE me.user_id = v_user_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_households() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_households() TO authenticated;

-- Number of shared households a user is in; at most 2 besides the personal one.
CREATE OR REPLACE FUNCTION public.count_shared_households(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT count(*)::int
  FROM public.household_members m
  JOIN public.households h ON h.id = m.household_id
  WHERE m.user_id = p_user_id AND h.personal_for IS NULL;
$$;

REVOKE ALL ON FUNCTION public.count_shared_households(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.new_invite_token()
RETURNS TEXT
LANGUAGE sql
VOLATILE
SET search_path = ''
AS $$
  SELECT replace(gen_random_uuid()::text, '-', '');
$$;

REVOKE ALL ON FUNCTION public.new_invite_token() FROM PUBLIC, anon, authenticated;

-- Creates a shared household with the caller as owner and makes it active.
CREATE OR REPLACE FUNCTION public.create_household(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_name TEXT := btrim(COALESCE(p_name, ''));
  v_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_signed_in';
  END IF;
  IF char_length(v_name) NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'invalid_name';
  END IF;
  IF (SELECT display_name FROM public.users WHERE id = v_user_id) IS NULL THEN
    RAISE EXCEPTION 'display_name_required';
  END IF;

  -- Serializes concurrent creates and joins of the same user, so the limit holds.
  PERFORM 1 FROM public.users WHERE id = v_user_id FOR UPDATE;
  IF public.count_shared_households(v_user_id) >= 2 THEN
    RAISE EXCEPTION 'household_limit_reached';
  END IF;

  INSERT INTO public.households (name) VALUES (v_name) RETURNING id INTO v_id;
  INSERT INTO public.household_members (household_id, user_id, role) VALUES (v_id, v_user_id, 'owner');
  UPDATE public.users SET active_household_id = v_id WHERE id = v_user_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_household(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_household(TEXT) TO authenticated;

-- What the invite page shows before joining. Null when the link is unknown,
-- expired or belongs to a personal household.
CREATE OR REPLACE FUNCTION public.preview_household_invite(p_token TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'household_id', h.id,
    'name', h.name,
    'member_names', (
      SELECT COALESCE(jsonb_agg(u.display_name ORDER BY m.joined_at), '[]'::jsonb)
      FROM public.household_members m
      JOIN public.users u ON u.id = m.user_id
      WHERE m.household_id = h.id
    ),
    'member_count', (SELECT count(*) FROM public.household_members m WHERE m.household_id = h.id),
    'is_member', public.is_household_member(h.id),
    'needs_display_name', (SELECT display_name IS NULL FROM public.users WHERE id = (SELECT auth.uid())),
    'at_household_limit', public.count_shared_households((SELECT auth.uid())) >= 2
  )
  FROM public.households h
  WHERE h.invite_token = p_token
    AND h.personal_for IS NULL
    AND h.invite_expires_at > NOW();
$$;

REVOKE ALL ON FUNCTION public.preview_household_invite(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_household_invite(TEXT) TO authenticated;

-- Joins the household behind an invite link and makes it active.
CREATE OR REPLACE FUNCTION public.join_household(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_signed_in';
  END IF;

  SELECT id INTO v_id
  FROM public.households
  WHERE invite_token = p_token AND personal_for IS NULL AND invite_expires_at > NOW()
  FOR UPDATE;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'invite_invalid';
  END IF;

  IF NOT public.is_household_member(v_id) THEN
    IF (SELECT display_name FROM public.users WHERE id = v_user_id) IS NULL THEN
      RAISE EXCEPTION 'display_name_required';
    END IF;

    PERFORM 1 FROM public.users WHERE id = v_user_id FOR UPDATE;
    IF public.count_shared_households(v_user_id) >= 2 THEN
      RAISE EXCEPTION 'household_limit_reached';
    END IF;
    IF (SELECT count(*) FROM public.household_members WHERE household_id = v_id) >= 10 THEN
      RAISE EXCEPTION 'household_full';
    END IF;

    INSERT INTO public.household_members (household_id, user_id, role) VALUES (v_id, v_user_id, 'member');
  END IF;

  UPDATE public.users SET active_household_id = v_id WHERE id = v_user_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.join_household(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_household(TEXT) TO authenticated;

-- The invite link of a shared household, made (or renewed for 7 days) when there
-- is no valid one. reset = true always makes a new one, so the old link stops working.
CREATE OR REPLACE FUNCTION public.get_household_invite(p_household_id UUID, p_reset BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household public.households;
BEGIN
  IF NOT public.is_household_member(p_household_id) THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;

  SELECT * INTO v_household FROM public.households WHERE id = p_household_id FOR UPDATE;

  IF v_household.personal_for IS NOT NULL THEN
    RAISE EXCEPTION 'personal_household';
  END IF;

  IF p_reset OR v_household.invite_token IS NULL OR v_household.invite_expires_at <= NOW() THEN
    UPDATE public.households
    SET invite_token = public.new_invite_token(),
        invite_expires_at = NOW() + INTERVAL '7 days'
    WHERE id = p_household_id
    RETURNING * INTO v_household;
  END IF;

  RETURN jsonb_build_object('token', v_household.invite_token, 'expires_at', v_household.invite_expires_at);
END;
$$;

REVOKE ALL ON FUNCTION public.get_household_invite(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_household_invite(UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.leave_household(p_household_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.households WHERE id = p_household_id AND personal_for IS NOT NULL) THEN
    RAISE EXCEPTION 'personal_household';
  END IF;

  -- The trigger hands over ownership and cleans up after the member.
  DELETE FROM public.household_members
  WHERE household_id = p_household_id AND user_id = (SELECT auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.leave_household(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_household(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_household_owner(p_household_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.household_members m
    JOIN public.households h ON h.id = m.household_id
    WHERE m.household_id = p_household_id
      AND m.user_id = (SELECT auth.uid())
      AND m.role = 'owner'
      AND h.personal_for IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.is_household_owner(UUID) FROM PUBLIC, anon, authenticated;

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
END;
$$;

REVOKE ALL ON FUNCTION public.remove_household_member(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_household_member(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.rename_household(p_household_id UUID, p_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name TEXT := btrim(COALESCE(p_name, ''));
BEGIN
  IF NOT public.is_household_owner(p_household_id) THEN
    RAISE EXCEPTION 'not_the_owner';
  END IF;
  IF char_length(v_name) NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'invalid_name';
  END IF;

  UPDATE public.households SET name = v_name WHERE id = p_household_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rename_household(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rename_household(UUID, TEXT) TO authenticated;

-- Any member may change how many people the household plans for (null = members).
CREATE OR REPLACE FUNCTION public.set_household_servings(p_household_id UUID, p_servings NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_household_member(p_household_id) THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;

  UPDATE public.households
  SET default_servings = p_servings
  WHERE id = p_household_id AND personal_for IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.set_household_servings(UUID, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_household_servings(UUID, NUMERIC) TO authenticated;

-- Deletes a shared household with its plans for everyone. Members whose active
-- household it was fall back to their personal one (ON DELETE SET NULL).
CREATE OR REPLACE FUNCTION public.delete_household(p_household_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_household_owner(p_household_id) THEN
    RAISE EXCEPTION 'not_the_owner';
  END IF;

  DELETE FROM public.households WHERE id = p_household_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_household(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_household(UUID) TO authenticated;

-- Switches the household the app shows; null means the personal one.
CREATE OR REPLACE FUNCTION public.set_active_household(p_household_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_household_id IS NOT NULL AND NOT public.is_household_member(p_household_id) THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;

  UPDATE public.users SET active_household_id = p_household_id WHERE id = (SELECT auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.set_active_household(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_active_household(UUID) TO authenticated;

-- The other members' recipes for a shared household: all columns except the
-- owner's star rating, plus the author's display name and the tag names. The
-- private import text (recipe_sources) stays with the owner.
CREATE OR REPLACE FUNCTION public.household_recipes(p_household_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(jsonb_agg(
    (to_jsonb(r) - 'rating') || jsonb_build_object(
      'rating', NULL,
      'author_name', u.display_name,
      'tags', COALESCE((
        SELECT jsonb_agg(DISTINCT t.name)
        FROM public.recipe_tags rt
        JOIN public.tags t ON t.id = rt.tag_id
        WHERE rt.recipe_id = r.id
      ), '[]'::jsonb)
    )
    ORDER BY r.created_at DESC
  ), '[]'::jsonb)
  FROM public.household_members m
  JOIN public.households h ON h.id = m.household_id
  JOIN public.recipes r ON r.user_id = m.user_id
  JOIN public.users u ON u.id = m.user_id
  WHERE m.household_id = p_household_id
    AND h.personal_for IS NULL
    AND m.user_id <> (SELECT auth.uid())
    AND public.is_household_member(p_household_id);
$$;

REVOKE ALL ON FUNCTION public.household_recipes(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.household_recipes(UUID) TO authenticated;

-- Live updates -----------------------------------------------------------------

-- Changes to a plan reach the other members' open apps right away.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'planned_meals'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.planned_meals;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'meal_plans'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.meal_plans;
    END IF;
  END IF;
END;
$$;

-- "Was ist neu?" (skipped if migration 013 hasn't run) ---------------------------

DO $$
BEGIN
  IF to_regclass('public.changelog') IS NOT NULL THEN
    INSERT INTO public.changelog (title, description)
    SELECT entry.title, entry.description
    FROM (VALUES
      ('Gemeinsam planen',
       'Leg im Profil unter „Haushalt“ einen gemeinsamen Haushalt an und lade per Link bis zu neun Leute ein. Ihr plant dieselbe Woche, seht Änderungen sofort und könnt die Rezepte der anderen direkt einplanen.'),
      ('Gelöschte Rezepte bleiben im Plan',
       'Löschst du ein Rezept, bleibt die Mahlzeit in deinen Wochen mit Namen und Kalorien stehen, statt einfach zu verschwinden.')
    ) AS entry(title, description)
    WHERE NOT EXISTS (SELECT 1 FROM public.changelog WHERE changelog.title = entry.title);
  END IF;
END;
$$;
