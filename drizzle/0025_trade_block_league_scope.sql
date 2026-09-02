-- League-scope trade-block data without destroying the legacy user_docs record.
-- user_docs is keyed only by user_id, so it cannot safely represent one user's
-- trade block in multiple leagues. New writes use (league_id, user_id).

CREATE TABLE IF NOT EXISTS league_trade_blocks (
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_name varchar(255) NOT NULL,
  version integer NOT NULL DEFAULT 0,
  updated_at timestamp NOT NULL DEFAULT now(),
  trade_block jsonb,
  trade_wants jsonb,
  PRIMARY KEY (league_id, user_id)
);

CREATE INDEX IF NOT EXISTS league_trade_blocks_league_updated_idx
  ON league_trade_blocks (league_id, updated_at DESC);

-- Backfill only records whose league can be identified safely:
-- 1. user_docs already has an explicit matching league_id, or
-- 2. the user belongs to exactly one LeagueZone league.
WITH unique_membership_users AS (
  SELECT li.claimed_by AS user_id
  FROM league_invites li
  WHERE li.claimed_by IS NOT NULL
  GROUP BY li.claimed_by
  HAVING COUNT(DISTINCT li.league_id) = 1
), candidates AS (
  SELECT DISTINCT ON (li.league_id, li.claimed_by)
    li.league_id,
    li.claimed_by AS user_id,
    li.team_name,
    COALESCE(ud.version, 0) AS version,
    COALESCE(ud.updated_at, now()) AS updated_at,
    ud.trade_block,
    ud.trade_wants
  FROM user_docs ud
  JOIN league_invites li
    ON li.claimed_by IS NOT NULL
   AND li.claimed_by::text = ud.user_id
  LEFT JOIN unique_membership_users umu
    ON umu.user_id = li.claimed_by
  WHERE (ud.league_id = li.league_id OR (ud.league_id IS NULL AND umu.user_id IS NOT NULL))
    AND (ud.trade_block IS NOT NULL OR ud.trade_wants IS NOT NULL)
  ORDER BY li.league_id, li.claimed_by, li.claimed_at DESC NULLS LAST, li.created_at DESC
)
INSERT INTO league_trade_blocks (
  league_id, user_id, team_name, version, updated_at, trade_block, trade_wants
)
SELECT league_id, user_id, team_name, version, updated_at, trade_block, trade_wants
FROM candidates
ON CONFLICT (league_id, user_id) DO NOTHING;
