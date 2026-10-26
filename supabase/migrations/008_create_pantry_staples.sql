-- Create pantry_staples table (per-user list of basic ingredients the shopping list can hide)
CREATE TABLE IF NOT EXISTS public.pantry_staples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Stored lowercase and trimmed by the app, matched against the trailing words of an ingredient.
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_pantry_staples_user_id ON public.pantry_staples(user_id);

-- Enable RLS
ALTER TABLE public.pantry_staples ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pantry_staples table
DROP POLICY IF EXISTS "Users can view their own pantry_staples" ON public.pantry_staples;
CREATE POLICY "Users can view their own pantry_staples"
  ON public.pantry_staples FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create pantry_staples" ON public.pantry_staples;
CREATE POLICY "Users can create pantry_staples"
  ON public.pantry_staples FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own pantry_staples" ON public.pantry_staples;
CREATE POLICY "Users can delete their own pantry_staples"
  ON public.pantry_staples FOR DELETE
  USING (auth.uid() = user_id);

-- Default staples (German + English) every user starts with; they can edit them afterwards.
CREATE OR REPLACE FUNCTION public.seed_pantry_staples(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.pantry_staples (user_id, name)
  SELECT target_user_id, staple
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
  ON CONFLICT (user_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Auto-seed default staples when a new user is created
DROP TRIGGER IF EXISTS create_pantry_staples_trigger ON public.users;
CREATE OR REPLACE FUNCTION public.create_pantry_staples()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.seed_pantry_staples(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER create_pantry_staples_trigger
AFTER INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.create_pantry_staples();

-- Backfill defaults for existing users who signed up before this migration
SELECT public.seed_pantry_staples(id) FROM public.users;

-- Only the migration and the trigger should seed; clients manage their rows directly.
REVOKE EXECUTE ON FUNCTION public.seed_pantry_staples(UUID) FROM PUBLIC, anon, authenticated;
