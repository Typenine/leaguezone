-- One bounded preferences record per real user; no public browsing writes.
CREATE TABLE IF NOT EXISTS leaguezone_dashboard_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
