import { sql } from 'drizzle-orm';
import { getDb, isDatabaseCircuitOpen } from '@/server/db/client';
import { getLeagueById } from '@/lib/server/league-context';
import { discoverLeagueChain, getLeague } from '@/lib/utils/sleeper-api';
import type { FantasyProviderId } from '@/lib/providers/types';
import { readReliabilityCache, reliabilityKey, writeReliabilityCache, type ReliabilityCacheResult } from '@/lib/server/reliability-cache';

export type LeagueProviderSeason = {
  id: string | null;
  leagueId: string;
  season: number;
  provider: FantasyProviderId;
  providerLeagueId: string;
  providerGameId: string | null;
  isCurrent: boolean;
  metadata: Record<string, unknown>;
  lastSyncedAt: Date | string | null;
};

export type LeagueProviderRuntimeConfig = {
  currentSeason: string;
  provider: FantasyProviderId | null;
  seasons: Record<string, { provider: FantasyProviderId; providerLeagueId: string }>;
  currentLeagueId: string;
  previousLeagueIds: Record<string, string>;
};

function rowsOf(result: unknown): Array<Record<string, unknown>> {
  return (result as { rows?: Array<Record<string, unknown>> }).rows ?? [];
}

function rowToSeason(row: Record<string, unknown>): LeagueProviderSeason | null {
  const provider = String(row.provider || '') as FantasyProviderId;
  if (provider !== 'sleeper' && provider !== 'yahoo') return null;
  const season = Number(row.season);
  if (!Number.isFinite(season)) return null;
  const providerLeagueId = String(row.provider_league_id || '').trim();
  if (!providerLeagueId) return null;
  return {
    id: row.id ? String(row.id) : null,
    leagueId: String(row.league_id),
    season,
    provider,
    providerLeagueId,
    providerGameId: row.provider_game_id ? String(row.provider_game_id) : null,
    isCurrent: Boolean(row.is_current),
    metadata: (row.metadata as Record<string, unknown>) || {},
    lastSyncedAt: (row.last_synced_at as Date | string | null) ?? null,
  };
}

const PROVIDER_SEASONS_FRESH_SECONDS = 5 * 60;
const PROVIDER_SEASONS_STALE_SECONDS = 7 * 24 * 60 * 60;

function providerSeasonsKey(leagueId: string): string {
  return reliabilityKey('provider-seasons', leagueId);
}

async function queryMappedSeasons(leagueId: string): Promise<LeagueProviderSeason[]> {
  const db = getDb();
  const result = await db.execute(sql`
    SELECT id, league_id, season, provider, provider_league_id, provider_game_id,
           is_current, metadata, last_synced_at
    FROM league_provider_seasons
    WHERE league_id = ${leagueId}::uuid
    ORDER BY is_current DESC, season DESC
  `);
  return rowsOf(result).map(rowToSeason).filter((row): row is LeagueProviderSeason => Boolean(row));
}

async function readMappedSeasonsResult(leagueId: string): Promise<ReliabilityCacheResult<LeagueProviderSeason[]>> {
  const key = providerSeasonsKey(leagueId);
  const fresh = await readReliabilityCache<LeagueProviderSeason[]>(key, PROVIDER_SEASONS_FRESH_SECONDS);
  if (fresh) return { ...fresh, stale: false };

  try {
    const value = await queryMappedSeasons(leagueId);
    await writeReliabilityCache(key, value, PROVIDER_SEASONS_STALE_SECONDS);
    return { value, stale: false, cachedAt: Date.now(), source: 'live' };
  } catch (error) {
    const fallback = await readReliabilityCache<LeagueProviderSeason[]>(key, PROVIDER_SEASONS_STALE_SECONDS);
    if (fallback) return fallback;
    throw error;
  }
}


async function backfillLegacySleeperMappings(leagueId: string, existing: LeagueProviderSeason[]): Promise<void> {
  const league = await getLeagueById(leagueId);
  if (!league || league.config?.provider === 'yahoo' || !league.sleeperLeagueId) return;
  const hasCurrent = existing.some((row) => row.provider === 'sleeper' && row.providerLeagueId === league.sleeperLeagueId);
  if (hasCurrent) return;

  let seasonMap: Record<string, string> = { ...(league.sleeperLeagueIds || {}) };
  if (Object.keys(seasonMap).length === 0 || !Object.values(seasonMap).includes(league.sleeperLeagueId)) {
    try {
      seasonMap = { ...seasonMap, ...(await discoverLeagueChain(league.sleeperLeagueId)) };
    } catch {
      // Current season can still be identified directly below.
    }
  }
  if (!Object.values(seasonMap).includes(league.sleeperLeagueId)) {
    try {
      const current = await getLeague(league.sleeperLeagueId);
      if (current?.season) seasonMap[current.season] = league.sleeperLeagueId;
    } catch {
      // Leave the legacy record untouched if Sleeper is unavailable.
    }
  }

  const db = getDb();
  for (const [seasonText, providerLeagueId] of Object.entries(seasonMap)) {
    if (!/^\d{4}$/.test(seasonText) || !providerLeagueId) continue;
    const season = Number.parseInt(seasonText, 10);
    const isCurrent = providerLeagueId === league.sleeperLeagueId;
    await db.execute(sql`
      INSERT INTO league_provider_seasons (
        league_id, season, provider, provider_league_id, is_current,
        metadata, last_synced_at, created_at, updated_at
      ) VALUES (
        ${leagueId}::uuid, ${season}, 'sleeper', ${providerLeagueId}, ${isCurrent},
        '{"source":"legacy-compat"}'::jsonb, now(), now(), now()
      )
      ON CONFLICT (league_id, season) DO NOTHING
    `).catch(() => {});
  }
}

export async function listLeagueProviderSeasonsResult(
  leagueId: string,
): Promise<ReliabilityCacheResult<LeagueProviderSeason[]>> {
  let result = await readMappedSeasonsResult(leagueId);

  if (!result.stale && !isDatabaseCircuitOpen()) {
    await backfillLegacySleeperMappings(leagueId, result.value).catch(() => {});
    result = await readMappedSeasonsResult(leagueId).catch(() => result);
  }

  const value = result.value.sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || b.season - a.season);
  return { ...result, value };
}

export async function listLeagueProviderSeasons(leagueId: string): Promise<LeagueProviderSeason[]> {
  return (await listLeagueProviderSeasonsResult(leagueId)).value;
}

export async function resolveLeagueProviderSeason(
  leagueId: string,
  season?: string | number | null,
): Promise<LeagueProviderSeason | null> {
  const seasons = await listLeagueProviderSeasons(leagueId);
  if (seasons.length === 0) return null;
  if (season != null && String(season).trim()) {
    const requested = Number.parseInt(String(season), 10);
    if (Number.isFinite(requested)) return seasons.find((item) => item.season === requested) || null;
  }
  return seasons.find((item) => item.isCurrent) || seasons[0] || null;
}

export async function getLeagueProviderRuntimeConfig(leagueId: string): Promise<LeagueProviderRuntimeConfig> {
  const seasons = await listLeagueProviderSeasons(leagueId);
  const current = seasons.find((item) => item.isCurrent) || seasons[0] || null;
  const seasonMap: LeagueProviderRuntimeConfig['seasons'] = {};
  for (const item of seasons) {
    seasonMap[String(item.season)] = {
      provider: item.provider,
      providerLeagueId: item.providerLeagueId,
    };
  }

  const sleeperSeasons = seasons.filter((item) => item.provider === 'sleeper');
  const currentLeagueId = current?.provider === 'sleeper' ? current.providerLeagueId : '';
  const previousLeagueIds = Object.fromEntries(
    sleeperSeasons
      .filter((item) => item.providerLeagueId !== currentLeagueId)
      .map((item) => [String(item.season), item.providerLeagueId]),
  );

  return {
    currentSeason: current ? String(current.season) : '',
    provider: current?.provider || null,
    seasons: seasonMap,
    currentLeagueId,
    previousLeagueIds,
  };
}
