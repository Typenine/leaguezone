CREATE TABLE IF NOT EXISTS provider_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider varchar(32) NOT NULL,
  provider_user_id varchar(255),
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS provider_accounts_user_provider_uidx
  ON provider_accounts(user_id, provider);
CREATE INDEX IF NOT EXISTS provider_accounts_provider_user_idx
  ON provider_accounts(provider, provider_user_id);

CREATE TABLE IF NOT EXISTS league_provider_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  season integer NOT NULL,
  provider varchar(32) NOT NULL,
  provider_league_id varchar(255) NOT NULL,
  provider_game_id varchar(255),
  is_current boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS league_provider_seasons_league_season_uidx
  ON league_provider_seasons(league_id, season);
CREATE INDEX IF NOT EXISTS league_provider_seasons_provider_league_idx
  ON league_provider_seasons(provider, provider_league_id);
CREATE INDEX IF NOT EXISTS league_provider_seasons_league_current_idx
  ON league_provider_seasons(league_id, is_current);

CREATE TABLE IF NOT EXISTS provider_league_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_provider_season_id uuid NOT NULL REFERENCES league_provider_seasons(id) ON DELETE CASCADE,
  snapshot_type varchar(64) NOT NULL,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS provider_league_snapshots_season_type_uidx
  ON provider_league_snapshots(league_provider_season_id, snapshot_type);
CREATE INDEX IF NOT EXISTS provider_league_snapshots_fetched_idx
  ON provider_league_snapshots(fetched_at);

-- Preserve every existing Sleeper season in the provider-neutral mapping.
-- We intentionally do not guess a season when only sleeper_league_id exists.
INSERT INTO league_provider_seasons (
  league_id,
  season,
  provider,
  provider_league_id,
  is_current,
  metadata,
  created_at,
  updated_at
)
SELECT
  l.id,
  entries.key::integer,
  'sleeper',
  entries.value,
  entries.value = l.sleeper_league_id,
  jsonb_build_object('backfilledFrom', 'sleeper_league_ids'),
  now(),
  now()
FROM leagues l
CROSS JOIN LATERAL jsonb_each_text(COALESCE(l.sleeper_league_ids, '{}'::jsonb)) AS entries(key, value)
WHERE entries.key ~ '^[0-9]{4}$'
  AND entries.value <> ''
ON CONFLICT (league_id, season) DO NOTHING;
