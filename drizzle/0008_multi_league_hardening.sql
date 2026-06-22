-- Multi-league hardening: indexes, composite user_docs key, commissioner index.

-- Index commissioner lookup
CREATE INDEX IF NOT EXISTS leagues_commissioner_idx ON leagues(commissioner_user_id);

-- Index for league_invites claimed_by (used in getUserLeagues)
CREATE INDEX IF NOT EXISTS league_invites_claimed_by_idx ON league_invites(claimed_by);

-- Add unique partial index for (user_id, league_id) on user_docs when league_id IS NOT NULL.
-- This allows per-league trade blocks without changing the existing PK structure.
CREATE UNIQUE INDEX IF NOT EXISTS user_docs_user_league_idx
  ON user_docs (user_id, league_id)
  WHERE league_id IS NOT NULL;

-- Add league_id to trade_block_events if not already present (safe re-add)
ALTER TABLE trade_block_events ADD COLUMN IF NOT EXISTS league_id uuid REFERENCES leagues(id);
CREATE INDEX IF NOT EXISTS trade_block_events_league_idx2 ON trade_block_events(league_id);
