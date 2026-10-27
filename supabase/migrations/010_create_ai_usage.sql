-- Daily count of AI requests per user (recipe import, "Aus Idee" and chat changes),
-- so a single account can't run up the Claude API bill.
CREATE TABLE IF NOT EXISTS public.ai_usage (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);

-- Enable RLS
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Users may read their own usage. Rows are only written by consume_ai_quota below,
-- so there are deliberately no INSERT, UPDATE or DELETE policies.
DROP POLICY IF EXISTS "Users can view their own ai_usage" ON public.ai_usage;
CREATE POLICY "Users can view their own ai_usage"
  ON public.ai_usage FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Counts one request for the calling user and returns whether it is within the limit.
CREATE OR REPLACE FUNCTION public.consume_ai_quota(daily_limit INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.ai_usage (user_id, usage_date, request_count)
  VALUES (auth.uid(), CURRENT_DATE, 1)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET request_count = public.ai_usage.request_count + 1
  RETURNING request_count INTO new_count;

  RETURN new_count <= daily_limit;
END;
$$;

-- Supabase also grants new functions to anon directly, so revoke that too.
REVOKE ALL ON FUNCTION public.consume_ai_quota(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(INTEGER) TO authenticated;
