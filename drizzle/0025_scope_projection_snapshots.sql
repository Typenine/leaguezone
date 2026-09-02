ALTER TABLE weekly_projection_snapshots
  ADD COLUMN IF NOT EXISTS league_id text NOT NULL DEFAULT '';

ALTER TABLE weekly_projection_snapshots
  DROP CONSTRAINT IF EXISTS weekly_projection_snapshots_pkey;

CREATE UNIQUE INDEX IF NOT EXISTS weekly_projection_snapshots_league_unique_idx
  ON weekly_projection_snapshots (league_id, season, week, team, model_version, phase, snapshot_date);

CREATE INDEX IF NOT EXISTS weekly_projection_snapshots_league_lookup_idx
  ON weekly_projection_snapshots (league_id, season, week, team, generated_at DESC);
