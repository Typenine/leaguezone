/**
 * Server-side utility for reading Sleeper league IDs from the database.
 * Use this in API routes and server components where process.env may not
 * have SLEEPER_LEAGUE_ID set (i.e. the user configured via setup wizard).
 *
 * Priority: env var > DB (so explicit Vercel env vars still work).
 *
 * If only a current league ID is stored (no previous seasons), the function
 * auto-discovers the full history by walking the Sleeper previous_league_id
 * chain. Results are persisted back to the DB so subsequent calls are fast.
 */

import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';

export interface LeagueIdsConfig {
  current: string;
  /** Map of season year string → Sleeper league ID for past seasons. */
  previous: Record<string, string>;
}

export async function getLeagueIdsFromDb(): Promise<LeagueIdsConfig> {
  // Explicit env var takes priority — supports traditional Vercel deployments.
  if (process.env.SLEEPER_LEAGUE_ID) {
    return { current: process.env.SLEEPER_LEAGUE_ID, previous: {} };
  }

  try {
    const db = getDb();
    const res = await db.execute(sql`
      SELECT id, sleeper_league_id, sleeper_league_ids
      FROM leagues
      WHERE setup_completed = true
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];

    const current = (row?.sleeper_league_id as string) || '';
    let allIds = (row?.sleeper_league_ids as Record<string, string>) || {};

    // previous = every season entry whose ID differs from the current one
    let previous: Record<string, string> = {};
    for (const [year, id] of Object.entries(allIds)) {
      if (id !== current) previous[year] = id;
    }

    // If no previous seasons are stored, auto-discover via the Sleeper chain
    // and persist back to DB so future calls skip the traversal.
    if (current && Object.keys(previous).length === 0) {
      try {
        // Lazy import to avoid circular deps at module load time
        const { discoverLeagueChain } = await import('@/lib/utils/sleeper-api');
        const chain = await discoverLeagueChain(current);
        const newPrevious: Record<string, string> = {};
        for (const [year, id] of Object.entries(chain)) {
          if (id !== current) newPrevious[year] = id;
        }
        if (Object.keys(newPrevious).length > 0) {
          previous = newPrevious;
          // Merge into allIds and persist so next call reads from DB
          allIds = { ...allIds, ...chain };
          const leagueRowId = row?.id as string;
          if (leagueRowId) {
            await db.execute(sql`
              UPDATE leagues
              SET sleeper_league_ids = ${JSON.stringify(allIds)}::jsonb,
                  updated_at = now()
              WHERE id = ${leagueRowId}::uuid
            `).catch(() => { /* non-fatal */ });
          }
        }
      } catch {
        // Non-fatal — app works with current season only
      }
    }

    return { current, previous };
  } catch {
    return { current: '', previous: {} };
  }
}
