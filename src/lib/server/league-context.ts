/**
 * League Context Helper
 * Provides the current league context scoped to the active request.
 */

import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { DEFAULT_LEAGUE_FEATURES, type LeagueFeatureKey } from '@/lib/config/platform';
import { readReliabilityCache, reliabilityKey, writeReliabilityCache } from '@/lib/server/reliability-cache';

const LEAGUE_FRESH_SECONDS = 5 * 60;
const LEAGUE_STALE_SECONDS = 7 * 24 * 60 * 60;

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
  _reliability?: {
    stale: boolean;
    cachedAt: number | null;
  };
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

function plainLeague(league: League): League {
  const { _reliability: _ignored, ...rest } = league;
  return rest;
}

function marked(league: League, stale: boolean, cachedAt: number | null): League {
  return { ...league, _reliability: { stale, cachedAt } };
}

function idKey(id: string) {
  return reliabilityKey('league', 'id', id);
}

function slugKey(slug: string) {
  return reliabilityKey('league', 'slug', slug);
}

async function cacheLeague(league: League): Promise<void> {
  const value = plainLeague(league);
  await Promise.all([
    writeReliabilityCache(idKey(value.id), value, LEAGUE_STALE_SECONDS),
    writeReliabilityCache(slugKey(value.slug), value, LEAGUE_STALE_SECONDS),
  ]);
}

async function cachedLeague(key: string, maxAgeSeconds: number, stale: boolean): Promise<League | null> {
  const cached = await readReliabilityCache<League>(key, maxAgeSeconds);
  return cached ? marked(cached.value, stale, cached.cachedAt) : null;
}

async function queryLeagueById(leagueId: string): Promise<League | null> {
  const db = getDb();
  const res = await db.execute(sql`
    SELECT * FROM leagues
    WHERE id = ${leagueId}::uuid
      AND setup_completed = true
      AND is_active = true
    LIMIT 1
  `);
  const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
  return row ? rowToLeague(row) : null;
}

async function queryLeagueBySlug(slug: string): Promise<League | null> {
  const db = getDb();
  const res = await db.execute(sql`
    SELECT * FROM leagues
    WHERE slug = ${slug}
      AND setup_completed = true
      AND is_active = true
    LIMIT 1
  `);
  const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
  return row ? rowToLeague(row) : null;
}

/**
 * Read-through league metadata cache. This is intentionally outside Postgres so
 * league shells and branding can still render during a Neon outage.
 */
export async function getLeagueById(leagueId: string): Promise<League | null> {
  const fresh = await cachedLeague(idKey(leagueId), LEAGUE_FRESH_SECONDS, false);
  if (fresh) return fresh;

  try {
    const league = await queryLeagueById(leagueId);
    if (league) await cacheLeague(league);
    return league;
  } catch {
    return cachedLeague(idKey(leagueId), LEAGUE_STALE_SECONDS, true);
  }
}

export async function getLeagueBySlug(slug: string): Promise<League | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  const fresh = await cachedLeague(slugKey(normalized), LEAGUE_FRESH_SECONDS, false);
  if (fresh) return fresh;

  try {
    const league = await queryLeagueBySlug(normalized);
    if (league) await cacheLeague(league);
    return league;
  } catch {
    return cachedLeague(slugKey(normalized), LEAGUE_STALE_SECONDS, true);
  }
}

/** Alias for getLeagueBySlug — kept for call-site compatibility. */
export async function getCurrentLeagueBySlug(slug: string): Promise<League | null> {
  return getLeagueBySlug(slug);
}

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

export function getLeagueFeatures(league: League): Record<LeagueFeatureKey, boolean> {
  const overrides = (league.config?.features ?? {}) as Partial<Record<LeagueFeatureKey, boolean>>;
  return { ...DEFAULT_LEAGUE_FEATURES, ...overrides };
}
