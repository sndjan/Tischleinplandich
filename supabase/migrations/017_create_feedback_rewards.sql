-- Premium days as thanks for feedback that got implemented or fixed. Rows are
-- granted by hand with grant_feedback_reward below; users can read their own.
CREATE TABLE IF NOT EXISTS public.feedback_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- One reward per feedback. Kept when the feedback row goes away.
  feedback_id UUID UNIQUE REFERENCES public.feedback(id) ON DELETE SET NULL,
  -- Copied from the feedback, which users can't read back, for the thank-you text.
  category TEXT NOT NULL CHECK (category IN ('bug', 'idea', 'other')),
  size TEXT NOT NULL CHECK (size IN ('small', 'medium', 'large')),
  days INTEGER NOT NULL CHECK (days BETWEEN 1 AND 90),
  -- Optional short name of what was built, shown to the user ("Gemeinsame Rezepte").
  note TEXT CHECK (note IS NULL OR char_length(note) <= 120),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_rewards_user ON public.feedback_rewards(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.feedback_rewards ENABLE ROW LEVEL SECURITY;

-- Users may read their own rewards. Rows are only written by grant_feedback_reward,
-- so there are deliberately no INSERT, UPDATE or DELETE policies.
DROP POLICY IF EXISTS "Users can view their own feedback_rewards" ON public.feedback_rewards;
CREATE POLICY "Users can view their own feedback_rewards"
  ON public.feedback_rewards FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Rewards one feedback row: small = 1 week, medium = 2 weeks, large = 1 month,
-- at most 90 days per account within a year (the last reward is cut to fit).
-- Returns the days granted. Run it from the SQL editor:
--   SELECT public.grant_feedback_reward('<feedback id>', 'large', 'Gemeinsame Rezepte');
CREATE OR REPLACE FUNCTION public.grant_feedback_reward(
  p_feedback_id UUID,
  p_size TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_category TEXT;
  v_days INTEGER;
  v_used INTEGER;
BEGIN
  v_days := CASE p_size WHEN 'small' THEN 7 WHEN 'medium' THEN 14 WHEN 'large' THEN 30 END;
  IF v_days IS NULL THEN
    RAISE EXCEPTION 'size must be small, medium or large';
  END IF;

  SELECT user_id, category INTO v_user_id, v_category
  FROM public.feedback
  WHERE id = p_feedback_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'feedback % not found', p_feedback_id;
  END IF;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'feedback % has no account any more', p_feedback_id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.feedback_rewards WHERE feedback_id = p_feedback_id) THEN
    RAISE EXCEPTION 'feedback % was already rewarded', p_feedback_id;
  END IF;

  -- Serializes grants for the same account so the yearly limit holds.
  PERFORM 1 FROM public.users WHERE id = v_user_id FOR UPDATE;

  SELECT COALESCE(SUM(days), 0) INTO v_used
  FROM public.feedback_rewards
  WHERE user_id = v_user_id AND created_at > NOW() - INTERVAL '1 year';

  v_days := LEAST(v_days, 90 - v_used);
  IF v_days <= 0 THEN
    RAISE EXCEPTION 'account already got 90 reward days this year';
  END IF;

  INSERT INTO public.feedback_rewards (user_id, feedback_id, category, size, days, note)
  VALUES (v_user_id, p_feedback_id, v_category, p_size, v_days, NULLIF(btrim(p_note), ''));

  UPDATE public.feedback SET status = 'done' WHERE id = p_feedback_id;

  RETURN v_days;
END;
$$;

-- Only for the SQL editor (postgres role); the app never calls it.
REVOKE ALL ON FUNCTION public.grant_feedback_reward(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- Announce it in "Was ist neu?" (skipped if migration 013 hasn't run).
DO $$
BEGIN
  IF to_regclass('public.changelog') IS NOT NULL THEN
    INSERT INTO public.changelog (title, description)
    SELECT 'Premium für dein Feedback',
           'Bauen wir deine Idee ein oder beheben einen Fehler, den du zuerst gemeldet hast, bekommst du je nach Umfang 1 Woche bis 1 Monat Premium geschenkt.'
    WHERE NOT EXISTS (SELECT 1 FROM public.changelog WHERE title = 'Premium für dein Feedback');
  END IF;
END;
$$;
