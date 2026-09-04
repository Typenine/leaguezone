/**
 * Centralized ownership check for league setup-wizard API routes.
 *
 * Historically these routes allowed a write when
 * `commissioner_user_id IS NULL`, on the assumption that only the league's
 * own creator would ever know its (cookie-scoped) id. League ids are in
 * fact returned by the public `/api/league/search` endpoint, so any
 * authenticated user could pass a foreign `leagueId` in the request body
 * and edit/claim a league they never created, as long as it had not yet
 * been assigned a commissioner.
 *
 * This helper closes that gap:
 *   - Once a league has finished setup (`setup_completed = true`) the
 *     null-commissioner bypass is never allowed.
 *   - The first authenticated write to an unclaimed, still-in-setup league
 *     atomically assigns that user as commissioner, so a second user can
 *     no longer piggy-back on the same leagueId.
 */
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';

export type SetupLeagueOwnership = {
  leagueId: string;
};

export async function requireSetupLeagueOwnership(
  userId: string,
  leagueId: string | null | undefined,
): Promise<SetupLeagueOwnership | null> {
  if (!leagueId) return null;

  const db = getDb();

  // Already-owned league (any setup state): allow.
  const ownedRes = await db.execute(sql`
    SELECT id FROM leagues
    WHERE id = ${leagueId}::uuid
      AND commissioner_user_id = ${userId}::uuid
    LIMIT 1
  `);
  if ((ownedRes as { rows?: unknown[] }).rows?.length) {
    return { leagueId };
  }

  // Unclaimed league still mid-setup: claim it atomically for this user.
  const claimRes = await db.execute(sql`
    UPDATE leagues
    SET commissioner_user_id = ${userId}::uuid, updated_at = now()
    WHERE id = ${leagueId}::uuid
      AND commissioner_user_id IS NULL
      AND setup_completed = false
    RETURNING id
  `);
  if ((claimRes as { rows?: unknown[] }).rows?.length) {
    return { leagueId };
  }

  return null;
}
