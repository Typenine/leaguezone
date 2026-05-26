/**
 * Server-side utility for reading Sleeper league IDs from the database.
 * Use this in API routes and server components where process.env may not
 * have SLEEPER_LEAGUE_ID set (i.e. the user configured via setup wizard).
 *
 * Priority: env var > DB (so explicit Vercel env vars still work).
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
      SELECT sleeper_league_id, sleeper_league_ids
      FROM leagues
      WHERE setup_completed = true
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];

    const current = (row?.sleeper_league_id as string) || '';
    const allIds = (row?.sleeper_league_ids as Record<string, string>) || {};

    // previous = every season entry whose ID differs from the current one
    const previous: Record<string, string> = {};
    for (const [year, id] of Object.entries(allIds)) {
      if (id !== current) previous[year] = id;
    }

    return { current, previous };
  } catch {
    return { current: '', previous: {} };
  }
}
