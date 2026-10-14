-- Research-only Sleeper connections. No corresponding hosted leagues, invites, or admin rights.
CREATE TABLE IF NOT EXISTS leaguezone_sleeper_research_connections (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sleeper_league_id text NOT NULL CHECK (sleeper_league_id ~ '^[0-9]{7,25}$'),
  sleeper_user_id text NOT NULL CHECK (sleeper_user_id ~ '^[0-9]+$'),
  roster_id integer NOT NULL CHECK (roster_id > 0),
  season integer NOT NULL CHECK (season BETWEEN 2017 AND 2100),
  league_name text NOT NULL,
  team_name text NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, sleeper_league_id)
);
CREATE INDEX IF NOT EXISTS leaguezone_sleeper_research_user
  ON leaguezone_sleeper_research_connections (user_id, added_at DESC);
