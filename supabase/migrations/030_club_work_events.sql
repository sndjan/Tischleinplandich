-- Prototype for a club ("Verein") module at /verein: work assignments members can sign up for
-- by name, and Web Push subscriptions of every device that turned on notifications.
-- Members have no account, so only the server (service role) reads and writes these tables:
-- RLS is on without any policies.

CREATE TABLE IF NOT EXISTS public.club_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  location TEXT NOT NULL DEFAULT '' CHECK (char_length(location) <= 120),
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE,
  -- How many helpers are needed; null means "as many as possible".
  helpers_needed INTEGER CHECK (helpers_needed IS NULL OR helpers_needed BETWEEN 1 AND 500),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT club_events_ends_after_start CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_club_events_starts_at ON public.club_events (starts_at);

CREATE TABLE IF NOT EXISTS public.club_event_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.club_events(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  -- Secret handed to the device that signed up, so only it can take the signup back.
  remove_token UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_event_signups_event_id ON public.club_event_signups (event_id);

CREATE TABLE IF NOT EXISTS public.club_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL UNIQUE CHECK (char_length(endpoint) <= 1000),
  p256dh TEXT NOT NULL CHECK (char_length(p256dh) <= 200),
  auth TEXT NOT NULL CHECK (char_length(auth) <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.club_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_event_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_push_subscriptions ENABLE ROW LEVEL SECURITY;
