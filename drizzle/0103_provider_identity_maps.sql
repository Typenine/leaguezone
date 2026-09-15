CREATE TABLE IF NOT EXISTS league_franchises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  display_name varchar(255) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS league_franchises_league_idx ON league_franchises(league_id);

CREATE TABLE IF NOT EXISTS provider_team_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_provider_season_id uuid NOT NULL REFERENCES league_provider_seasons(id) ON DELETE CASCADE,
  franchise_id uuid NOT NULL REFERENCES league_franchises(id) ON DELETE CASCADE,
  provider_team_id varchar(255) NOT NULL,
  roster_id integer,
  owner_provider_id varchar(255),
  team_name_snapshot varchar(255) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS provider_team_identities_season_team_uidx
  ON provider_team_identities(league_provider_season_id, provider_team_id);
CREATE INDEX IF NOT EXISTS provider_team_identities_franchise_idx ON provider_team_identities(franchise_id);
CREATE INDEX IF NOT EXISTS provider_team_identities_owner_idx ON provider_team_identities(owner_provider_id);

CREATE TABLE IF NOT EXISTS fantasy_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name varchar(255) NOT NULL,
  position varchar(32),
  nfl_team varchar(32),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fantasy_players_name_position_idx ON fantasy_players(lower(canonical_name), position);

CREATE TABLE IF NOT EXISTS fantasy_player_external_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fantasy_player_id uuid NOT NULL REFERENCES fantasy_players(id) ON DELETE CASCADE,
  provider varchar(32) NOT NULL,
  provider_player_id varchar(255) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS fantasy_player_external_ids_provider_uidx
  ON fantasy_player_external_ids(provider, provider_player_id);
CREATE INDEX IF NOT EXISTS fantasy_player_external_ids_player_idx ON fantasy_player_external_ids(fantasy_player_id);
