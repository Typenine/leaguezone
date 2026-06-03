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

export interface LeagueSummary {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  foundedYear: number | null;
}

export interface LeagueHomepageData extends LeagueSummary {
  sleeperLeagueId: string | null;
}

export interface LeagueBranding {
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  rulesContent: string | null;
  rulesFileKey: string | null;
}

export async function getLeagueIdsFromDb(leagueId?: string): Promise<LeagueIdsConfig> {
  // Explicit env var takes priority — supports traditional Vercel deployments.
  if (process.env.SLEEPER_LEAGUE_ID) {
    return { current: process.env.SLEEPER_LEAGUE_ID, previous: {} };
  }

  try {
    const db = getDb();
    const defaultLeagueQuery = sql`
      SELECT id, sleeper_league_id, sleeper_league_ids
      FROM leagues
      WHERE setup_completed = true
      ORDER BY created_at DESC
      LIMIT 1
    `;

    let row: Record<string, unknown> | undefined;
    if (leagueId) {
      const res = await db.execute(sql`
        SELECT id, sleeper_league_id, sleeper_league_ids
        FROM leagues
        WHERE setup_completed = true
          AND id = ${leagueId}::uuid
        LIMIT 1
      `);
      row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    }

    // Stale or missing active_league_id cookie — fall back to the default league.
    if (!row) {
      const res = await db.execute(defaultLeagueQuery);
      row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    }

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

export async function getAllLeagues(): Promise<LeagueSummary[]> {
  try {
    const db = getDb();
    const res = await db.execute(sql`
      SELECT id, slug, name, short_name, logo_url, primary_color, secondary_color, founded_year
      FROM leagues
      WHERE setup_completed = true
        AND is_active = true
      ORDER BY created_at ASC
    `);
    const rows = (res as { rows?: Array<Record<string, unknown>> }).rows ?? [];
    return rows.map((r) => ({
      id: r.id as string,
      slug: (r.slug as string) || '',
      name: (r.name as string) || '',
      shortName: (r.short_name as string | null) ?? null,
      logoUrl: (r.logo_url as string | null) ?? null,
      primaryColor: (r.primary_color as string | null) ?? null,
      secondaryColor: (r.secondary_color as string | null) ?? null,
      foundedYear: (r.founded_year as number | null) ?? null,
    }));
  } catch {
    return [];
  }
}

export async function getLeagueBySlug(slug: string): Promise<LeagueHomepageData | null> {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) return null;

  try {
    const db = getDb();
    const res = await db.execute(sql`
      SELECT id, slug, name, short_name, logo_url, primary_color, secondary_color, founded_year, sleeper_league_id
      FROM leagues
      WHERE setup_completed = true
        AND is_active = true
        AND slug = ${normalizedSlug}
      LIMIT 1
    `);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    if (!row) return null;

    return {
      id: row.id as string,
      slug: (row.slug as string) || normalizedSlug,
      name: (row.name as string) || '',
      shortName: (row.short_name as string | null) ?? null,
      logoUrl: (row.logo_url as string | null) ?? null,
      primaryColor: (row.primary_color as string | null) ?? null,
      secondaryColor: (row.secondary_color as string | null) ?? null,
      foundedYear: (row.founded_year as number | null) ?? null,
      sleeperLeagueId: (row.sleeper_league_id as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export async function getLeagueBranding(leagueId?: string): Promise<LeagueBranding> {
  const fallback: LeagueBranding = {
    name: '',
    shortName: null,
    logoUrl: null,
    primaryColor: null,
    secondaryColor: null,
    rulesContent: null,
    rulesFileKey: null,
  };
  try {
    const db = getDb();
    const defaultBrandingQuery = sql`
      SELECT name, short_name, logo_url, primary_color, secondary_color, rules_content, rules_file_key
      FROM leagues
      WHERE setup_completed = true
      ORDER BY created_at DESC
      LIMIT 1
    `;

    let row: Record<string, unknown> | undefined;
    if (leagueId) {
      const res = await db.execute(sql`
        SELECT name, short_name, logo_url, primary_color, secondary_color, rules_content, rules_file_key
        FROM leagues
        WHERE setup_completed = true
          AND id = ${leagueId}::uuid
        LIMIT 1
      `);
      row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    }

    if (!row) {
      const res = await db.execute(defaultBrandingQuery);
      row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    }
    if (!row) return fallback;
    return {
      name: (row.name as string) || '',
      shortName: (row.short_name as string | null) ?? null,
      logoUrl: (row.logo_url as string | null) ?? null,
      primaryColor: (row.primary_color as string | null) ?? null,
      secondaryColor: (row.secondary_color as string | null) ?? null,
      rulesContent: (row.rules_content as string | null) ?? null,
      rulesFileKey: (row.rules_file_key as string | null) ?? null,
    };
  } catch {
    return fallback;
  }
}
