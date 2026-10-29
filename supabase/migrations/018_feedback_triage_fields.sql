-- Fields the daily triage task fills in, so rewards can be proposed once an issue
-- is closed: which GitHub issue a feedback row went into and how big the change is.
-- The repo is public, so this link lives here and not in the issue.
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS issue_number INTEGER;
-- 'none' means no reward (e.g. declined when the proposal was reviewed).
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS reward_size TEXT;
ALTER TABLE public.feedback DROP CONSTRAINT IF EXISTS feedback_reward_size_check;
ALTER TABLE public.feedback ADD CONSTRAINT feedback_reward_size_check
  CHECK (reward_size IS NULL OR reward_size IN ('none', 'small', 'medium', 'large'));

CREATE INDEX IF NOT EXISTS idx_feedback_issue_number ON public.feedback(issue_number, created_at)
  WHERE issue_number IS NOT NULL;

-- "Who sent it first" decides the reward, and the insert policy can't stop users
-- from sending their own created_at or triage fields. Set them on the server.
CREATE OR REPLACE FUNCTION public.normalize_new_feedback()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.created_at := NOW();
  NEW.issue_number := NULL;
  NEW.reward_size := NULL;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_new_feedback() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS feedback_normalize_new ON public.feedback;
CREATE TRIGGER feedback_normalize_new
  BEFORE INSERT ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.normalize_new_feedback();
