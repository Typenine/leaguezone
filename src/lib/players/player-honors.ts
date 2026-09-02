import { getAllPlayersCached, getLeague, getLeagueMatchups, type SleeperMatchup } from '@/lib/utils/sleeper-api';
import type { PlayerHonor } from '@/lib/types/player-honors';

type Context = { currentSeason: string; currentLeagueId: string; previousLeagueIds?: Record<string, string> };
const cache = new Map<string, { ts: number; honors: Map<string, PlayerHonor[]> }>();

export async function getPlayerHonors(playerId: string, context: Context): Promise<PlayerHonor[]> {
  const cacheKey = `${context.currentLeagueId}:${context.currentSeason}`;
  let entry = cache.get(cacheKey);
  if (!entry || Date.now() - entry.ts > 15 * 60 * 1000) {
    const players = await getAllPlayersCached();
    const honors = new Map<string, PlayerHonor[]>();
    const leagues = { ...(context.previousLeagueIds || {}), [context.currentSeason]: context.currentLeagueId };
    for (const [season, leagueId] of Object.entries(leagues)) {
      const league = await getLeague(leagueId).catch(() => null);
      if (!league) continue;
      const settings = (league.settings || {}) as { playoff_week_start?: number; playoff_start_week?: number };
      const endWeek = Math.max(1, Math.min(17, Number(settings.playoff_week_start ?? settings.playoff_start_week ?? 15) - 1));
      const weeks = await Promise.all(Array.from({ length: endWeek }, (_, index) => getLeagueMatchups(leagueId, index + 1).catch(() => [] as SleeperMatchup[])));
      const totals = new Map<string, number>();
      weeks.flat().forEach((matchup) => Object.entries(matchup.players_points || {}).forEach(([id, points]) => totals.set(id, (totals.get(id) || 0) + Number(points || 0))));
      const eligible = [...totals.entries()].filter(([id]) => players[id] && !['DEF', 'K'].includes(players[id].position || ''));
      const add = (id: string, honor: PlayerHonor) => honors.set(id, [...(honors.get(id) || []), honor]);
      const positionCounts = new Map<string, number>();
      (league.roster_positions || []).filter((slot) => ['QB', 'RB', 'WR', 'TE'].includes(slot)).forEach((slot) => positionCounts.set(slot, (positionCounts.get(slot) || 0) + 1));
      for (const position of ['QB', 'RB', 'WR', 'TE']) {
        const count = Math.max(1, positionCounts.get(position) || 1);
        const ranked = eligible.filter(([id]) => players[id].position === position).sort((a, b) => b[1] - a[1]);
        ranked.slice(0, count).forEach(([id]) => add(id, { id: `${season}:first:${position}:${id}`, season, kind: 'all_league_first', label: 'First Team All-League', position, source: 'statistical' }));
        ranked.slice(count, count * 2).forEach(([id]) => add(id, { id: `${season}:second:${position}:${id}`, season, kind: 'all_league_second', label: 'Second Team All-League', position, source: 'statistical' }));
      }
      const mvp = eligible.sort((a, b) => b[1] - a[1])[0]?.[0];
      if (mvp) add(mvp, { id: `${season}:mvp:${mvp}`, season, kind: 'mvp', label: 'League MVP', position: players[mvp].position, source: 'statistical' });
      if (season === context.currentSeason) {
        const rookie = eligible.filter(([id]) => Number((players[id] as { years_exp?: number }).years_exp || 0) <= 1).sort((a, b) => b[1] - a[1])[0]?.[0];
        if (rookie) add(rookie, { id: `${season}:roy:${rookie}`, season, kind: 'rookie_of_year', label: 'Rookie of the Year', position: players[rookie].position, source: 'statistical' });
      }
    }
    for (const rows of honors.values()) rows.sort((a, b) => b.season.localeCompare(a.season));
    entry = { ts: Date.now(), honors };
    cache.set(cacheKey, entry);
  }
  return [...(entry.honors.get(playerId) || [])];
}
