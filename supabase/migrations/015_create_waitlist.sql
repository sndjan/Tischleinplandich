-- Waitlist for launch news with double opt-in. Only the server (service role)
-- reads and writes it, so RLS is on without any policies.
CREATE TABLE IF NOT EXISTS public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE CHECK (email = lower(btrim(email)) AND char_length(email) BETWEEN 3 AND 254),
  -- Secret from the confirmation mail; also used by the unsubscribe link.
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  -- The consent text shown when signing up, as proof of what was agreed to.
  consent_text TEXT NOT NULL,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  last_mail_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Finds unconfirmed sign-ups to clean up after 30 days.
CREATE INDEX IF NOT EXISTS idx_waitlist_unconfirmed_created_at
  ON public.waitlist (created_at)
  WHERE confirmed_at IS NULL;

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
