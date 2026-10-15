-- Immutable account-scoped pregame decision receipts.
CREATE TABLE IF NOT EXISTS fantasy_decision_receipts (
 id bigserial PRIMARY KEY,
 user_id uuid NOT NULL,
 scope_key varchar(180) NOT NULL,
 provider_league_id varchar(32) NOT NULL,
 roster_id integer NOT NULL,
 season integer NOT NULL,
 week integer NOT NULL CHECK (week BETWEEN 1 AND 18),
 model_version varchar(96) NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 predicted_gain double precision NOT NULL,
 suggested_start jsonb NOT NULL,
 suggested_bench jsonb NOT NULL,
 status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','evaluated')),
 actual_gain double precision,
 evaluated_at timestamptz,
 UNIQUE (user_id,scope_key,roster_id,season,week,model_version)
);
CREATE INDEX IF NOT EXISTS fantasy_decision_receipts_account_idx
 ON fantasy_decision_receipts (user_id,scope_key,recorded_at DESC);
