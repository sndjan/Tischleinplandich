-- Shopping list and pantry staples per household (step 2 of docs/households.md).
-- The list used to live only in each device's browser storage; now everyone in
-- a household sees the same checks, items and settings, live.

-- Marks on a week's list: checked items, items removed from it (already at
-- home) and planned recipes left off it. A surrogate id keeps the item names out
-- of Realtime delete events, which reach every subscriber with the primary key.
CREATE TABLE IF NOT EXISTS public.shopping_marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('checked', 'removed', 'excluded_recipe')),
  -- "ingredient|unit" of a list row, "custom|<item id>", or a recipe id.
  item_key TEXT NOT NULL CHECK (char_length(item_key) BETWEEN 1 AND 300),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (household_id, week_start_date, kind, item_key)
);

-- Items put on the list by hand: own items (no week, they stay until removed,
-- as before) and a recipe's ingredients without planning it (one week).
CREATE TABLE IF NOT EXISTS public.shopping_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  week_start_date DATE,
  kind TEXT NOT NULL CHECK (kind IN ('custom', 'extra')),
  -- The item itself, or the recipe's name for extras.
  label TEXT NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 200),
  amount TEXT CHECK (amount IS NULL OR char_length(amount) <= 50),
  -- Extras: the chosen ingredient lines as written and the portion factor.
  lines JSONB CHECK (
    lines IS NULL OR (jsonb_typeof(lines) = 'array' AND jsonb_array_length(lines) <= 200 AND pg_column_size(lines) <= 20000)
  ),
  multiplier NUMERIC CHECK (multiplier IS NULL OR multiplier BETWEEN 0 AND 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT shopping_items_extra_complete CHECK (
    kind = 'custom' OR (week_start_date IS NOT NULL AND lines IS NOT NULL AND multiplier IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_shopping_marks_household_week ON public.shopping_marks(household_id, week_start_date);
CREATE INDEX IF NOT EXISTS idx_shopping_items_household ON public.shopping_items(household_id, week_start_date);

-- List settings shared by the household (were per device).
ALTER TABLE public.households ADD COLUMN IF NOT EXISTS shopping_hide_basics BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.households ADD COLUMN IF NOT EXISTS shopping_section_order TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.households DROP CONSTRAINT IF EXISTS households_section_order_length;
ALTER TABLE public.households ADD CONSTRAINT households_section_order_length
  CHECK (cardinality(shopping_section_order) <= 30);

ALTER TABLE public.shopping_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;

-- Rows are only added and removed (checking twice is a no-op), so there are
-- deliberately no UPDATE policies.
DROP POLICY IF EXISTS "Members can view shopping_marks" ON public.shopping_marks;
CREATE POLICY "Members can view shopping_marks"
  ON public.shopping_marks FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

DROP POLICY IF EXISTS "Members can create shopping_marks" ON public.shopping_marks;
CREATE POLICY "Members can create shopping_marks"
  ON public.shopping_marks FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member(household_id));

DROP POLICY IF EXISTS "Members can delete shopping_marks" ON public.shopping_marks;
CREATE POLICY "Members can delete shopping_marks"
  ON public.shopping_marks FOR DELETE TO authenticated
  USING (public.is_household_member(household_id));

DROP POLICY IF EXISTS "Members can view shopping_items" ON public.shopping_items;
CREATE POLICY "Members can view shopping_items"
  ON public.shopping_items FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

DROP POLICY IF EXISTS "Members can create shopping_items" ON public.shopping_items;
CREATE POLICY "Members can create shopping_items"
  ON public.shopping_items FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member(household_id));

DROP POLICY IF EXISTS "Members can delete shopping_items" ON public.shopping_items;
CREATE POLICY "Members can delete shopping_items"
  ON public.shopping_items FOR DELETE TO authenticated
  USING (public.is_household_member(household_id));

-- Limits the app never reaches but the API would otherwise allow.
CREATE OR REPLACE FUNCTION public.enforce_shopping_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_NAME = 'shopping_items' THEN
    IF (SELECT count(*) FROM public.shopping_items WHERE household_id = NEW.household_id) >= 500 THEN
      RAISE EXCEPTION 'shopping_limit_reached' USING ERRCODE = 'check_violation';
    END IF;
  ELSIF (
    SELECT count(*) FROM public.shopping_marks
    WHERE household_id = NEW.household_id AND week_start_date = NEW.week_start_date
  ) >= 2000 THEN
    RAISE EXCEPTION 'shopping_limit_reached' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_shopping_limits() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS shopping_items_enforce_limit ON public.shopping_items;
CREATE TRIGGER shopping_items_enforce_limit
  BEFORE INSERT ON public.shopping_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_shopping_limits();

DROP TRIGGER IF EXISTS shopping_marks_enforce_limit ON public.shopping_marks;
CREATE TRIGGER shopping_marks_enforce_limit
  BEFORE INSERT ON public.shopping_marks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_shopping_limits();

-- Any member may change the list settings; null leaves a setting as it is.
CREATE OR REPLACE FUNCTION public.set_shopping_settings(
  p_household_id UUID,
  p_hide_basics BOOLEAN DEFAULT NULL,
  p_section_order TEXT[] DEFAULT NULL
)
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
  SET shopping_hide_basics = COALESCE(p_hide_basics, shopping_hide_basics),
      shopping_section_order = COALESCE(p_section_order, shopping_section_order)
  WHERE id = p_household_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_shopping_settings(UUID, BOOLEAN, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_shopping_settings(UUID, BOOLEAN, TEXT[]) TO authenticated;

-- Pantry staples belong to a household -----------------------------------------

ALTER TABLE public.pantry_staples
  ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households(id) ON DELETE CASCADE;

UPDATE public.pantry_staples ps
SET household_id = h.id
FROM public.households h
WHERE ps.household_id IS NULL AND h.personal_for = ps.user_id;

-- Rows of users without a personal household can't exist after migration 030;
-- anything left over has no owner to show it to.
DELETE FROM public.pantry_staples WHERE household_id IS NULL;

ALTER TABLE public.pantry_staples ALTER COLUMN household_id SET NOT NULL;

-- One staple per household instead of per user. user_id now only says who added
-- it; a shared household keeps its staples when that account is deleted.
DO $$
DECLARE
  v_constraint RECORD;
BEGIN
  FOR v_constraint IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.pantry_staples'::regclass
      AND (
        (c.contype = 'u' AND c.conkey::int2[] @> ARRAY[
          (SELECT attnum FROM pg_attribute WHERE attrelid = c.conrelid AND attname = 'user_id'),
          (SELECT attnum FROM pg_attribute WHERE attrelid = c.conrelid AND attname = 'name')
        ]::int2[])
        OR (c.contype = 'f' AND c.confrelid = 'public.users'::regclass)
      )
  LOOP
    EXECUTE format('ALTER TABLE public.pantry_staples DROP CONSTRAINT %I', v_constraint.conname);
  END LOOP;
END;
$$;

ALTER TABLE public.pantry_staples ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.pantry_staples DROP CONSTRAINT IF EXISTS pantry_staples_user_id_fkey;
ALTER TABLE public.pantry_staples ADD CONSTRAINT pantry_staples_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pantry_staples_household_name ON public.pantry_staples(household_id, name);
CREATE INDEX IF NOT EXISTS idx_pantry_staples_household ON public.pantry_staples(household_id);

-- App versions from before this migration add staples without a household; they
-- go to the personal one, where staples always were.
CREATE OR REPLACE FUNCTION public.default_pantry_staple_household()
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

REVOKE ALL ON FUNCTION public.default_pantry_staple_household() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS pantry_staples_default_household ON public.pantry_staples;
CREATE TRIGGER pantry_staples_default_household
  BEFORE INSERT ON public.pantry_staples
  FOR EACH ROW EXECUTE FUNCTION public.default_pantry_staple_household();

DROP POLICY IF EXISTS "Users can view their own pantry_staples" ON public.pantry_staples;
DROP POLICY IF EXISTS "Users can create pantry_staples" ON public.pantry_staples;
DROP POLICY IF EXISTS "Users can delete their own pantry_staples" ON public.pantry_staples;

DROP POLICY IF EXISTS "Members can view pantry_staples" ON public.pantry_staples;
CREATE POLICY "Members can view pantry_staples"
  ON public.pantry_staples FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));

DROP POLICY IF EXISTS "Members can create pantry_staples" ON public.pantry_staples;
CREATE POLICY "Members can create pantry_staples"
  ON public.pantry_staples FOR INSERT TO authenticated
  WITH CHECK (public.is_household_member(household_id) AND user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Members can delete pantry_staples" ON public.pantry_staples;
CREATE POLICY "Members can delete pantry_staples"
  ON public.pantry_staples FOR DELETE TO authenticated
  USING (public.is_household_member(household_id));

-- New accounts get the default staples in their personal household. Replaces the
-- version from migration 008, whose conflict target (user_id, name) is gone.
CREATE OR REPLACE FUNCTION public.seed_pantry_staples(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := public.ensure_personal_household(target_user_id);
BEGIN
  INSERT INTO public.pantry_staples (user_id, household_id, name)
  SELECT target_user_id, v_household_id, staple
  FROM unnest(ARRAY[
    -- Salt & pepper
    'salz', 'meersalz', 'pfeffer', 'salz und pfeffer',
    'salt', 'sea salt', 'black pepper', 'ground pepper', 'salt and pepper',
    -- Oils & vinegar
    'öl', 'olivenöl', 'sonnenblumenöl', 'rapsöl', 'pflanzenöl', 'speiseöl',
    'oil', 'olive oil', 'sunflower oil', 'canola oil', 'vegetable oil',
    'essig', 'balsamico', 'balsamicoessig', 'vinegar', 'balsamic vinegar',
    -- Dried herbs & spices
    'oregano', 'thymian', 'paprikapulver', 'kreuzkümmel', 'kümmel', 'zimt',
    'muskat', 'muskatnuss', 'currypulver', 'chiliflocken', 'chilipulver',
    'cayennepfeffer', 'kurkuma', 'lorbeerblatt', 'lorbeerblätter',
    'knoblauchpulver', 'italienische kräuter',
    'thyme', 'cumin', 'cinnamon', 'nutmeg', 'curry powder', 'chili flakes',
    'chili powder', 'cayenne', 'cayenne pepper', 'turmeric', 'bay leaf',
    'bay leaves', 'garlic powder', 'italian seasoning',
    -- Baking & basics
    'zucker', 'mehl', 'backpulver', 'natron', 'wasser', 'sojasauce', 'sojasoße',
    'sugar', 'flour', 'baking powder', 'baking soda', 'water', 'soy sauce'
  ]) AS staple
  ON CONFLICT (household_id, name) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.seed_pantry_staples(UUID) FROM PUBLIC, anon, authenticated;

-- The trigger function from migration 008, now with an empty search_path.
CREATE OR REPLACE FUNCTION public.create_pantry_staples()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.seed_pantry_staples(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.create_pantry_staples() FROM PUBLIC, anon, authenticated;

-- Household functions from migration 030 with the shopping additions ----------

-- Now also returns the shared list settings.
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
        'shopping_hide_basics', h.shopping_hide_basics,
        'shopping_section_order', to_jsonb(h.shopping_section_order),
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

-- Now also copies the creator's pantry staples and list settings into the new
-- household, so its list doesn't suddenly fill up with salt and oil.
CREATE OR REPLACE FUNCTION public.create_household(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_name TEXT := btrim(COALESCE(p_name, ''));
  v_personal public.households;
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

  SELECT * INTO v_personal FROM public.households WHERE id = public.ensure_personal_household(v_user_id);

  INSERT INTO public.households (name, shopping_hide_basics, shopping_section_order)
  VALUES (v_name, v_personal.shopping_hide_basics, v_personal.shopping_section_order)
  RETURNING id INTO v_id;
  INSERT INTO public.household_members (household_id, user_id, role) VALUES (v_id, v_user_id, 'owner');

  INSERT INTO public.pantry_staples (user_id, household_id, name)
  SELECT v_user_id, v_id, name FROM public.pantry_staples WHERE household_id = v_personal.id
  ON CONFLICT (household_id, name) DO NOTHING;

  UPDATE public.users SET active_household_id = v_id WHERE id = v_user_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_household(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_household(TEXT) TO authenticated;

-- Live updates -----------------------------------------------------------------

DO $$
DECLARE
  v_table TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH v_table IN ARRAY ARRAY['shopping_marks', 'shopping_items', 'pantry_staples', 'households'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_table
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
      END IF;
    END LOOP;
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
      ('Gemeinsame Einkaufsliste',
       'Im gemeinsamen Haushalt hakt ihr dieselbe Liste ab: Was jemand in den Wagen legt, ist bei allen sofort abgehakt, auch eigene Artikel und Grundzutaten teilt ihr. Ohne Netz merkt sich die App deine Haken und schickt sie, sobald du wieder online bist.'),
      ('Einkaufsliste auf allen Geräten',
       'Deine Einkaufsliste liegt jetzt in deinem Konto statt nur im Browser, auf Handy und Laptop also dieselbe. Was du bisher abgehakt hattest, wird einmal übernommen.')
    ) AS entry(title, description)
    WHERE NOT EXISTS (SELECT 1 FROM public.changelog WHERE changelog.title = entry.title);
  END IF;
END;
$$;
