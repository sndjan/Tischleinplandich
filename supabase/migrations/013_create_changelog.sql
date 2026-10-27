-- "Was ist neu?" in the profile: one row per change, newest first.
CREATE TABLE IF NOT EXISTS public.changelog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  released_on DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_changelog_released_on ON public.changelog(released_on DESC, created_at DESC);

-- Enable RLS
ALTER TABLE public.changelog ENABLE ROW LEVEL SECURITY;

-- Everyone signed in can read it. There is deliberately no INSERT, UPDATE or
-- DELETE policy: entries are added in the Supabase dashboard or SQL editor.
DROP POLICY IF EXISTS "Signed-in users can read the changelog" ON public.changelog;
CREATE POLICY "Signed-in users can read the changelog"
  ON public.changelog FOR SELECT TO authenticated
  USING (true);
