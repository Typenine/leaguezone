/**
 * League Context Helper
 * Provides the current league context scoped to the active request.
 * The active league is resolved from:
 *   1. An explicit slug (from /l/[leagueSlug] routes)
 *   2. The active_league_id cookie (from the user's selected league)
 *
 * Does NOT fall back to "most recently created league" to prevent cross-league
 * data leakage on a multi-tenant platform.
 */

import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { DEFAULT_LEAGUE_FEATURES, type LeagueFeatureKey } from '@/lib/config/platform';

export type League = {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  sleeperLeagueId: string | null;
  sleeperLeagueIds: Record<string, string>;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  config: Record<string, unknown>;
  foundedYear: number | null;
  isActive: boolean;
};

function rowToLeague(row: Record<string, unknown>): League {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    shortName: row.short_name ? String(row.short_name) : null,
    sleeperLeagueId: row.sleeper_league_id ? String(row.sleeper_league_id) : null,
    sleeperLeagueIds: (row.sleeper_league_ids as Record<string, string>) || {},
    logoUrl: row.logo_url ? String(row.logo_url) : null,
    primaryColor: row.primary_color ? String(row.primary_color) : null,
    secondaryColor: row.secondary_color ? String(row.secondary_color) : null,
    config: (row.config as Record<string, unknown>) || {},
    foundedYear: row.founded_year ? Number(row.founded_year) : null,
    isActive: Boolean(row.is_active),
  };
}

/**
 * Get the league for a given DB league ID.
 * Only returns active, setup-completed leagues.
 */
export async function getLeagueById(leagueId: string): Promise<League | null> {
  try {
    const db = getDb();
    const res = await db.execute(sql`
      SELECT * FROM leagues WHERE id = ${leagueId}::uuid AND setup_completed = true AND is_active = true LIMIT 1
    `);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    return row ? rowToLeague(row) : null;
  } catch {
    return null;
  }
}

/**
 * Get a league by its slug.
 * Only returns active, setup-completed leagues.
 */
export async function getLeagueBySlug(slug: string): Promise<League | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;
  try {
    const db = getDb();
    const res = await db.execute(sql`
      SELECT * FROM leagues WHERE slug = ${normalized} AND setup_completed = true AND is_active = true LIMIT 1
    `);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    return row ? rowToLeague(row) : null;
  } catch {
    return null;
  }
}

/** Alias for getLeagueBySlug — kept for call-site compatibility. */
export async function getCurrentLeagueBySlug(slug: string): Promise<League | null> {
  return getLeagueBySlug(slug);
}

/**
 * Get the current league from the active_league_id cookie.
 * Returns null if no active league is selected.
 *
 * IMPORTANT: This must only be called from Server Components or API routes
 * (requires next/headers). Do NOT fall back to "most recently created league"
 * as that would bleed East v. West data into other leagues.
 */
export async function getCurrentLeague(): Promise<League | null> {
  try {
    const { cookies } = await import('next/headers');
    const jar = await cookies();
    const leagueId = jar.get('active_league_id')?.value;
    if (!leagueId) return null;
    return getLeagueById(leagueId);
  } catch {
    return null;
  }
}

export async function getCurrentLeagueId(): Promise<string | null> {
  const league = await getCurrentLeague();
  return league?.id ?? null;
}

/** No-op — kept for backwards compatibility; there is no longer a module-level cache. */
export function clearLeagueCache(): void {}

/**
 * Effective feature flags for a league: defaults merged with any overrides
 * stored under `leagues.config.features`.
 */
export function getLeagueFeatures(league: League): Record<LeagueFeatureKey, boolean> {
  const overrides = (league.config?.features ?? {}) as Partial<Record<LeagueFeatureKey, boolean>>;
  return { ...DEFAULT_LEAGUE_FEATURES, ...overrides };
}
