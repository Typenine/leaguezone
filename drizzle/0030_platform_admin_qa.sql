-- Platform-admin QA sessions and league-scoped draft metadata.
-- Draft tables are created lazily by the application, so all draft ALTERs
-- are conditional and are also enforced at runtime by draft-scope-queries.ts.

CREATE TABLE IF NOT EXISTS qa_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  perspective varchar(24) NOT NULL CHECK (perspective IN ('public','member','team','commissioner')),
  team_name varchar(255),
  roster_id integer,
  mode varchar(16) NOT NULL DEFAULT 'view' CHECK (mode IN ('view','rehearsal')),
  draft_id uuid,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '8 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qa_sessions_admin_active_idx ON qa_sessions(admin_user_id, active, updated_at DESC);
CREATE INDEX IF NOT EXISTS qa_sessions_league_idx ON qa_sessions(league_id, updated_at DESC);

DO $$
BEGIN
  IF to_regclass('public.drafts') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE drafts ADD COLUMN IF NOT EXISTS league_id uuid REFERENCES leagues(id)';
    EXECUTE 'ALTER TABLE drafts ADD COLUMN IF NOT EXISTS environment varchar(16) NOT NULL DEFAULT ''live''';
    EXECUTE 'ALTER TABLE drafts ADD COLUMN IF NOT EXISTS qa_session_id uuid';
    EXECUTE 'ALTER TABLE drafts ADD COLUMN IF NOT EXISTS archived_at timestamptz';
    EXECUTE 'CREATE INDEX IF NOT EXISTS drafts_league_env_idx ON drafts(league_id, environment, year, created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS drafts_qa_session_idx ON drafts(qa_session_id)';

    -- A legacy draft is safe to associate automatically only when exactly one
    -- configured league exists. Multi-league installs require explicit scoping.
    IF (SELECT COUNT(*) FROM leagues WHERE setup_completed = true) = 1 THEN
      EXECUTE 'UPDATE drafts SET league_id = (SELECT id FROM leagues WHERE setup_completed = true LIMIT 1) WHERE league_id IS NULL';
    END IF;
  END IF;

  IF to_regclass('public.draft_workspace') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE draft_workspace ALTER COLUMN id TYPE varchar(96)';
  END IF;
END $$;
