-- Explicit opt-in web-push devices, scoped to authenticated platform accounts.
CREATE TABLE IF NOT EXISTS leaguezone_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth_secret text NOT NULL,
  research_updates boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_research_version text,
  CHECK (length(endpoint) <= 2048),
  CHECK (length(p256dh) <= 160),
  CHECK (length(auth_secret) <= 80)
);
CREATE INDEX IF NOT EXISTS leaguezone_push_subscriptions_user_id_idx
  ON leaguezone_push_subscriptions (user_id);
