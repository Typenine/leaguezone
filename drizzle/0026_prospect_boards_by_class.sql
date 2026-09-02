CREATE TABLE IF NOT EXISTS team_prospect_draftboard_state_v3 (
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  draft_class_year integer NOT NULL,
  team varchar(255) NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, user_id, draft_class_year)
);

CREATE INDEX IF NOT EXISTS idx_team_prospect_draftboard_team_v3
  ON team_prospect_draftboard_state_v3 (league_id, draft_class_year, team);
