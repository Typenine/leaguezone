import { getFantasyMatchups, getFantasyRosters } from '@/lib/server/fantasy-data';
import { resolveLeagueProviderSeason } from '@/lib/server/provider-seasons';
import { getFreshYahooAccessTokenForLeague } from '@/lib/server/provider-accounts';
import { getYahooWeeklyRoster } from '@/lib/providers/yahoo-weekly';
import type { FantasyPlayer, FantasyTeamData } from '@/lib/providers/types';

export type ProviderScoredMatchupDetail = {
  provider: 'yahoo';
  season: string;
  week: number;
  matchupId: number;
  teams: Array<{
    team: FantasyTeamData;
    points: number;
    starters: Array<FantasyPlayer & { points: number | null }>;
    bench: Array<FantasyPlayer & { points: number | null }>;
    playerScoringAvailable: boolean;
  }>;
};

export async function getYahooScoredMatchupDetail(
  leagueId: string,
  week: number,
  matchupId: number,
  season?: string | number | null,
): Promise<ProviderScoredMatchupDetail | null> {
  const mapped = await resolveLeagueProviderSeason(leagueId, season);
  if (!mapped || mapped.provider !== 'yahoo') return null;
  const [matchups, rosters] = await Promise.all([
    getFantasyMatchups(leagueId, week, mapped.season),
    getFantasyRosters(leagueId, mapped.season),
  ]);
  const matchup = matchups.find((row) => row.matchupId === matchupId);
  if (!matchup) return null;
  const token = await getFreshYahooAccessTokenForLeague(leagueId).catch(() => null);

  const teams = await Promise.all(matchup.teams.map(async (side) => {
    const team = rosters.teams.find((row) => row.rosterId === side.rosterId) || {
      providerTeamId: side.providerTeamId,
      rosterId: side.rosterId,
      teamName: side.teamName,
      ownerId: side.providerTeamId,
      ownerName: null,
      logoUrl: null,
      wins: 0,
      losses: 0,
      ties: 0,
      fpts: 0,
      fptsAgainst: 0,
      players: side.players,
    };
    const fallbackPlayers = team.players.map((id) => rosters.players[id]).filter((player): player is FantasyPlayer => Boolean(player));
    if (!token) {
      return { team, points: side.points, starters: [], bench: fallbackPlayers.map((player) => ({ ...player, points: null })), playerScoringAvailable: false };
    }
    try {
      const weekly = await getYahooWeeklyRoster(token, side.providerTeamId, week);
      const starterSet = new Set(weekly.starters);
      const players = weekly.players;
      return {
        team,
        points: side.points,
        starters: players.filter((player) => starterSet.has(player.playerId)).map((player) => ({ ...player, points: weekly.playerPoints[player.playerId] ?? null })),
        bench: players.filter((player) => !starterSet.has(player.playerId)).map((player) => ({ ...player, points: weekly.playerPoints[player.playerId] ?? null })),
        playerScoringAvailable: Object.keys(weekly.playerPoints).length > 0,
      };
    } catch {
      return { team, points: side.points, starters: [], bench: fallbackPlayers.map((player) => ({ ...player, points: null })), playerScoringAvailable: false };
    }
  }));

  return { provider: 'yahoo', season: String(mapped.season), week, matchupId, teams };
}
