-- Create feedback table (short bug reports and feature wishes sent from the app)
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('bug', 'idea', 'other')),
  message TEXT NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 2000),
  -- Where the user was and on which device, to help reproduce bugs.
  context TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'seen', 'done')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

-- Enable RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Users may only submit feedback as themselves. There is deliberately no SELECT,
-- UPDATE or DELETE policy: feedback is read in the Supabase dashboard (or with the
-- service role key), which bypasses RLS.
DROP POLICY IF EXISTS "Users can create feedback" ON feedback;
CREATE POLICY "Users can create feedback"
  ON feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'new');
