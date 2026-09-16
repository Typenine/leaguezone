import type { League } from '@/lib/server/league-context';
import { getLeagueIdsFromDb } from '@/lib/server/league-config';
import { getFantasyHistorySummary } from '@/lib/server/provider-deep-data';
import { listLeagueProviderSeasons } from '@/lib/server/provider-seasons';
import { getHeadToHeadAllTime, type H2HCell } from '@/lib/utils/headtohead';
import HistoricalSpotlight from './HistoricalSpotlight';

function cell(wins: number, losses: number, ties: number): H2HCell {
  return {
    meetings: wins + losses + ties,
    wins: { total: wins, regular: wins, playoffs: 0, toilet: 0 },
    losses: { total: losses, regular: losses, playoffs: 0, toilet: 0 },
    ties,
  };
}

export default async function LeagueHistorySpotlight({ league }: { league: League }) {
  const seasons = await listLeagueProviderSeasons(league.id).catch(() => []);
  if (seasons.some((row) => row.provider === 'yahoo')) {
    const history = await getFantasyHistorySummary(league.id).catch(() => null);
    if (!history) return null;
    const nameById = new Map(history.franchises.map((row) => [row.franchiseId, row.currentName] as const));
    const teams = history.franchises.map((row) => row.currentName).sort((a, b) => a.localeCompare(b));
    const matrix: Record<string, Record<string, H2HCell>> = Object.fromEntries(teams.map((team) => [team, Object.fromEntries(teams.map((opponent) => [opponent, cell(0, 0, 0)]))]));
    for (const row of history.headToHead) {
      const a = nameById.get(row.franchiseA);
      const b = nameById.get(row.franchiseB);
      if (!a || !b) continue;
      matrix[a][b] = cell(row.aWins, row.bWins, row.ties);
      matrix[b][a] = cell(row.bWins, row.aWins, row.ties);
    }
    const neverBeaten = teams.flatMap((team) => teams.flatMap((vs) => {
      if (team === vs) return [];
      const record = matrix[team]?.[vs];
      return record && record.meetings > 0 && record.wins.total === 0 ? [{ team, vs, meetings: record.meetings }] : [];
    }));
    return <HistoricalSpotlight h2h={{ teams, matrix, neverBeaten }} historyHref={`/l/${league.slug}/history`} />;
  }

  const leagueIds = await getLeagueIdsFromDb(league.id);
  const h2h = leagueIds.current
    ? await getHeadToHeadAllTime(undefined, leagueIds).catch(() => ({ teams: [], matrix: {}, neverBeaten: [] }))
    : { teams: [], matrix: {}, neverBeaten: [] };
  return <HistoricalSpotlight h2h={h2h} historyHref={`/l/${league.slug}/history`} />;
}
