import { getLeagueBySlug, type League } from '@/lib/server/league-context';
import { getLeagueIdsFromDb } from '@/lib/server/league-config';
import { getLeague } from '@/lib/utils/sleeper-api';
import type { LeagueStatsContext } from './league-stats-v2';

export async function buildLeagueStatsContext(league: League): Promise<LeagueStatsContext | null> {
  const ids = await getLeagueIdsFromDb(league.id);
  if (!ids.current) return null;
  const sleeper = await getLeague(ids.current).catch(() => null);
  const mappedCurrentSeason = Object.entries(league.sleeperLeagueIds || {})
    .find(([, id]) => id === ids.current)?.[0];
  const currentSeason = String(sleeper?.season || mappedCurrentSeason || new Date().getUTCFullYear());
  return { ...ids, currentSeason, cacheKey: league.id };
}

export async function getLeagueStatsContextBySlug(slug?: string | null): Promise<LeagueStatsContext | undefined> {
  if (!slug) return undefined;
  const league = await getLeagueBySlug(slug);
  if (!league) throw new Error('League stats context unavailable');
  const context = await buildLeagueStatsContext(league);
  if (!context) throw new Error('League stats context unavailable');
  return context;
}
