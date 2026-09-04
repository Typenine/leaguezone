-- LeagueZone normalized franchise branding history.
-- Roster slots are used as the default franchise continuity key so ownership changes
-- do not rewrite franchise history. Existing config/team_colors remain supported as fallbacks.

CREATE TABLE IF NOT EXISTS franchise_brand_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  franchise_key varchar(128) NOT NULL,
  season integer NOT NULL,
  roster_id integer,
  sleeper_owner_id varchar(64),
  team_name varchar(255) NOT NULL,
  abbreviation varchar(32),
  logo_url text,
  primary_color varchar(16),
  secondary_color varchar(16),
  tertiary_color varchar(16),
  quaternary_color varchar(16),
  source varchar(32) NOT NULL DEFAULT 'leaguezone',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT franchise_brand_history_unique UNIQUE (league_id, franchise_key, season)
);

CREATE INDEX IF NOT EXISTS franchise_brand_history_league_season_idx
  ON franchise_brand_history (league_id, season);
CREATE INDEX IF NOT EXISTS franchise_brand_history_owner_idx
  ON franchise_brand_history (league_id, sleeper_owner_id, season);
CREATE INDEX IF NOT EXISTS franchise_brand_history_roster_idx
  ON franchise_brand_history (league_id, roster_id, season);
