import type { FantasyTransaction } from '@/lib/providers/types';
import { getCurrentLeagueId } from '@/lib/server/league-context';
import { getFantasyTransactionsForSeason } from '@/lib/server/fantasy-data';
import { listLeagueProviderSeasons } from '@/lib/server/provider-seasons';

export type LeagueTransaction = FantasyTransaction;

export type TransactionsSummary = {
  totalFaab: number;
  totalsByTeam: { team: string; faab: number }[];
  totalsBySeason: { season: string; faab: number }[];
  count: number;
};

async function resolveLeagueId(explicit?: string): Promise<string | null> {
  return explicit || await getCurrentLeagueId();
}

export async function listAllSeasons(dbLeagueId?: string): Promise<string[]> {
  const leagueId = await resolveLeagueId(dbLeagueId);
  if (!leagueId) return [];
  const seasons = await listLeagueProviderSeasons(leagueId).catch(() => []);
  return seasons.map((item) => String(item.season)).sort((a, b) => b.localeCompare(a));
}

export async function buildTransactionLedger(arg?: { season?: string; dbLeagueId?: string }): Promise<LeagueTransaction[]> {
  const leagueId = await resolveLeagueId(arg?.dbLeagueId);
  if (!leagueId) return [];
  const seasons = await listLeagueProviderSeasons(leagueId).catch(() => []);
  const requested = arg?.season ? seasons.filter((item) => String(item.season) === arg.season) : seasons;
  const chunks = await Promise.all(requested.map((item) => getFantasyTransactionsForSeason(leagueId, item.season).catch(() => [])));
  return chunks.flat().sort((a, b) => b.created - a.created);
}
