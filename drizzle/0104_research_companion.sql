CREATE TABLE IF NOT EXISTS user_research_library (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 data jsonb NOT NULL DEFAULT '{"players":[],"views":[],"updatedAt":0}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS user_notification_preferences (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 enabled boolean NOT NULL DEFAULT false,
 role_changes boolean NOT NULL DEFAULT true,
 league_activity boolean NOT NULL DEFAULT false,
 draft_alerts boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS user_push_subscriptions (
 endpoint_hash text PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 endpoint text NOT NULL,
 p256dh text NOT NULL,
 auth text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 last_seen_at timestamptz NOT NULL DEFAULT now(),
 last_test_at timestamptz
);
CREATE INDEX IF NOT EXISTS user_push_subscriptions_user_idx ON user_push_subscriptions(user_id);
CREATE TABLE IF NOT EXISTS user_push_role_alerts (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 player_id text NOT NULL,
 year int NOT NULL,
 week int NOT NULL,
 direction text NOT NULL CHECK (direction IN ('rising','falling')),
 sent_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (user_id,player_id,year,week,direction)
);
