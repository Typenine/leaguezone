-- Platform-level beta feedback. This is intentionally separate from league
-- suggestions/voting so product feedback cannot leak into league governance data.
CREATE TABLE IF NOT EXISTS beta_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  league_id uuid REFERENCES leagues(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category IN ('bug', 'suggestion', 'usability', 'other')),
  summary varchar(120) NOT NULL,
  details text NOT NULL,
  page_path varchar(500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT beta_feedback_summary_length CHECK (char_length(summary) BETWEEN 3 AND 120),
  CONSTRAINT beta_feedback_details_length CHECK (char_length(details) BETWEEN 3 AND 5000)
);

CREATE INDEX IF NOT EXISTS beta_feedback_created_at_idx ON beta_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS beta_feedback_user_idx ON beta_feedback(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS beta_feedback_league_idx ON beta_feedback(league_id) WHERE league_id IS NOT NULL;
