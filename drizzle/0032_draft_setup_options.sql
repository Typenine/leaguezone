-- LeagueZone draft setup options
-- Persists player-pool eligibility/sync metadata and the commissioner-selected draft order type.

ALTER TABLE drafts
  ADD COLUMN IF NOT EXISTS player_pool_type varchar(32) NOT NULL DEFAULT 'all_players';

ALTER TABLE drafts
  ADD COLUMN IF NOT EXISTS player_pool_synced_at timestamptz;

ALTER TABLE drafts
  ADD COLUMN IF NOT EXISTS draft_order_type varchar(16) NOT NULL DEFAULT 'linear';
