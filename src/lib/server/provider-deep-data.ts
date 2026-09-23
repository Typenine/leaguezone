import type { FantasyPlayer, FantasyProviderId, FantasyTeamData } from '@/lib/providers/types';
import { getProviderCapabilities, type ProviderCapabilities } from '@/lib/providers/capabilities';
import { getYahooLeagueDraftResults, type ProviderDraftResult } from '@/lib/providers/yahoo-draft';
import { getFreshYahooAccessTokenForLeague } from '@/lib/server/provider-accounts';
import { getFantasyMatchups, getFantasyRosters, getFantasyStandings } from '@/lib/server/fantasy-data';
import { syncProviderIdentities, resolveLeaguePlayerId, type ProviderIdentityMaps } from '@/lib/server/provider-identities';
import { listLeagueProviderSeasons, resolveLeagueProviderSeason } from '@/lib/server/provider-seasons';
import { readProviderSnapshot, snapshotIsFresh, writeProviderSnapshot } from '@/lib/server/provider-snapshots';
import { readThroughReliabilityCache, reliabilityKey, type ReliabilityCacheResult } from '@/lib/server/reliability-cache';

const emptyIdentities = (): ProviderIdentityMaps => ({
  franchiseByRosterId: {},
  leaguePlayerByProviderPlayerId: {},
});

export type TeamScheduleRow = {
  week: number;
  matchupId: number;
  opponentRosterId: number;
  opponentName: string;
  points: number;
  opponentPoints: number;
  result: 'W' | 'L' | 'T' | null;
};

export type FantasyTeamDetail = {
  provider: FantasyProviderId;
  season: string;
  capabilities: ProviderCapabilities;
  team: FantasyTeamData;
  franchiseId: string | null;
  players: Array<FantasyPlayer & { leaguePlayerId: string | null }>;
  schedule: TeamScheduleRow[];
};

export async function getFantasyTeamDetail(
  leagueId: string,
  rosterId: number,
  season?: string | number | null,
): Promise<FantasyTeamDetail | null> {
  const mapped = await resolveLeagueProviderSeason(leagueId, season);
  if (!mapped) return null;
  const rosters = await getFantasyRosters(leagueId, mapped.season);
  const team = rosters.teams.find((row) => row.rosterId === rosterId);
  if (!team) return null;
  const identities = await syncProviderIdentities(mapped, rosters.teams, rosters.players).catch(emptyIdentities);
  const weeks = Array.from({ length: 18 }, (_, index) => index + 1);
  const weekly = await Promise.all(weeks.map((week) => getFantasyMatchups(leagueId, week, mapped.season).catch(() => [])));
  const schedule: TeamScheduleRow[] = [];
  for (let index = 0; index < weekly.length; index++) {
    const matchup = weekly[index].find((row) => row.teams.some((side) => side.rosterId === rosterId));
    if (!matchup || matchup.teams.length < 2) continue;
    const side = matchup.teams.find((row) => row.rosterId === rosterId);
    const opponent = matchup.teams.find((row) => row.rosterId !== rosterId);
    if (!side || !opponent) continue;
    const played = side.points !== 0 || opponent.points !== 0;
    schedule.push({
      week: index + 1,
      matchupId: matchup.matchupId,
      opponentRosterId: opponent.rosterId,
      opponentName: opponent.teamName,
      points: side.points,
      opponentPoints: opponent.points,
      result: !played ? null : side.points > opponent.points ? 'W' : side.points < opponent.points ? 'L' : 'T',
    });
  }
  return {
    provider: mapped.provider,
    season: String(mapped.season),
    capabilities: getProviderCapabilities(mapped.provider),
    team,
    franchiseId: identities.franchiseByRosterId[rosterId] || null,
    players: team.players.map((id) => rosters.players[id]).filter((player): player is FantasyPlayer => Boolean(player)).map((player) => ({
      ...player,
      leaguePlayerId: identities.leaguePlayerByProviderPlayerId[player.playerId] || null,
    })),
    schedule,
  };
}

export type FantasyMatchupDetail = {
  provider: FantasyProviderId;
  season: string;
  week: number;
  matchupId: number;
  capabilities: ProviderCapabilities;
  teams: Array<{
    team: FantasyTeamData;
    points: number;
    starters: Array<FantasyPlayer & { points: number | null }>;
    bench: Array<FantasyPlayer & { points: number | null }>;
  }>;
};

export async function getFantasyMatchupDetail(
  leagueId: string,
  week: number,
  matchupId: number,
  season?: string | number | null,
): Promise<FantasyMatchupDetail | null> {
  const mapped = await resolveLeagueProviderSeason(leagueId, season);
  if (!mapped) return null;
  const [matchups, rosters] = await Promise.all([
    getFantasyMatchups(leagueId, week, mapped.season),
    getFantasyRosters(leagueId, mapped.season),
  ]);
  const matchup = matchups.find((row) => row.matchupId === matchupId);
  if (!matchup) return null;
  const teams = matchup.teams.map((side) => {
    const team = rosters.teams.find((row) => row.rosterId === side.rosterId) || {
      providerTeamId: side.providerTeamId,
      rosterId: side.rosterId,
      teamName: side.teamName,
      ownerId: side.providerTeamId,
      ownerName: null,
      logoUrl: null,
      wins: 0, losses: 0, ties: 0, fpts: 0, fptsAgainst: 0,
      players: side.players,
    };
    const starterIds = new Set(side.starters);
    const playerIds = side.players.length ? side.players : team.players;
    const rows = playerIds.map((id) => rosters.players[id]).filter((player): player is FantasyPlayer => Boolean(player));
    return {
      team,
      points: side.points,
      starters: rows.filter((player) => starterIds.has(player.playerId) || player.isStarter).map((player) => ({ ...player, points: side.playerPoints[player.playerId] ?? null })),
      bench: rows.filter((player) => !starterIds.has(player.playerId) && !player.isStarter).map((player) => ({ ...player, points: side.playerPoints[player.playerId] ?? null })),
    };
  });
  return { provider: mapped.provider, season: String(mapped.season), week, matchupId, capabilities: getProviderCapabilities(mapped.provider), teams };
}

export type FantasyPlayerDetail = {
  leaguePlayerId: string | null;
  player: FantasyPlayer;
  seasons: Array<{ season: number; provider: FantasyProviderId; teamName: string; rosterId: number }>;
};

export async function getFantasyPlayerDetail(leagueId: string, providerPlayerId: string): Promise<FantasyPlayerDetail | null> {
  const seasons = await listLeagueProviderSeasons(leagueId);
  const providerHint: FantasyProviderId = providerPlayerId.includes('.p.') ? 'yahoo' : 'sleeper';
  let leaguePlayerId = await resolveLeaguePlayerId(providerHint, providerPlayerId).catch(() => null);
  let found: FantasyPlayer | null = null;
  const loaded: Array<{ mapped: (typeof seasons)[number]; rosters: Awaited<ReturnType<typeof getFantasyRosters>>; identities: ProviderIdentityMaps }> = [];

  // Synchronize identities first so a Yahoo ID can resolve to the same LeagueZone player
  // as a Sleeper ID before we walk historical roster appearances.
  for (const mapped of seasons) {
    const rosters = await getFantasyRosters(leagueId, mapped.season).catch(() => null);
    if (!rosters) continue;
    const identities = await syncProviderIdentities(mapped, rosters.teams, rosters.players).catch(emptyIdentities);
    const direct = rosters.players[providerPlayerId];
    if (direct) {
      found = found || direct;
      leaguePlayerId = leaguePlayerId || identities.leaguePlayerByProviderPlayerId[direct.playerId] || null;
    }
    loaded.push({ mapped, rosters, identities });
  }

  if (!leaguePlayerId) leaguePlayerId = await resolveLeaguePlayerId(providerHint, providerPlayerId).catch(() => null);
  const appearances: FantasyPlayerDetail['seasons'] = [];
  for (const { mapped, rosters, identities } of loaded) {
    for (const team of rosters.teams) {
      const match = team.players.find((id) => {
        if (id === providerPlayerId) return true;
        return Boolean(leaguePlayerId && identities.leaguePlayerByProviderPlayerId[id] === leaguePlayerId);
      });
      if (!match) continue;
      const player = rosters.players[match];
      if (player && !found) found = player;
      appearances.push({ season: mapped.season, provider: mapped.provider, teamName: team.teamName, rosterId: team.rosterId });
    }
  }
  if (!found) return null;
  const deduped = appearances.filter((row, index, all) => all.findIndex((item) => item.season === row.season && item.rosterId === row.rosterId) === index);
  return { leaguePlayerId, player: found, seasons: deduped.sort((a, b) => b.season - a.season) };
}

export type FranchiseHistoryRow = {
  franchiseId: string;
  currentName: string;
  seasons: number[];
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
};
export type HeadToHeadRow = { franchiseA: string; franchiseB: string; aWins: number; bWins: number; ties: number };
export type ScoringWeekRow = { season: number; week: number; franchiseId: string; teamName: string; points: number };
export type FantasyHistorySummary = {
  providers: FantasyProviderId[];
  franchises: FranchiseHistoryRow[];
  headToHead: HeadToHeadRow[];
  topScoringWeeks: ScoringWeekRow[];
  seasons: Array<{ season: number; provider: FantasyProviderId }>;
};

async function loadFantasyHistorySummary(leagueId: string): Promise<FantasyHistorySummary> {
  const seasons = await listLeagueProviderSeasons(leagueId);
  const franchiseMap = new Map<string, FranchiseHistoryRow>();
  const h2h = new Map<string, HeadToHeadRow>();
  const scoringWeeks: ScoringWeekRow[] = [];
  for (const mapped of seasons) {
    const rosters = await getFantasyRosters(leagueId, mapped.season).catch(() => null);
    if (!rosters) continue;
    const identities = await syncProviderIdentities(mapped, rosters.teams, rosters.players).catch(emptyIdentities);
    for (const team of rosters.teams) {
      const franchiseId = identities.franchiseByRosterId[team.rosterId] || `${mapped.provider}:${team.ownerId || team.providerTeamId}`;
      const row = franchiseMap.get(franchiseId) || { franchiseId, currentName: team.teamName, seasons: [], wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0 };
      row.currentName = team.teamName;
      if (!row.seasons.includes(mapped.season)) row.seasons.push(mapped.season);
      row.wins += team.wins; row.losses += team.losses; row.ties += team.ties; row.pointsFor += team.fpts; row.pointsAgainst += team.fptsAgainst;
      franchiseMap.set(franchiseId, row);
    }
    const weekly = await Promise.all(Array.from({ length: 18 }, (_, index) => getFantasyMatchups(leagueId, index + 1, mapped.season).catch(() => [])));
    for (let index = 0; index < weekly.length; index++) {
      for (const matchup of weekly[index]) {
        if (matchup.teams.length < 2) continue;
        const [a, b] = matchup.teams;
        if (a.points === 0 && b.points === 0) continue;
        const aId = identities.franchiseByRosterId[a.rosterId] || `${mapped.provider}:${a.providerTeamId}`;
        const bId = identities.franchiseByRosterId[b.rosterId] || `${mapped.provider}:${b.providerTeamId}`;
        scoringWeeks.push({ season: mapped.season, week: index + 1, franchiseId: aId, teamName: a.teamName, points: a.points });
        scoringWeeks.push({ season: mapped.season, week: index + 1, franchiseId: bId, teamName: b.teamName, points: b.points });
        const ordered = [aId, bId].sort();
        const key = ordered.join('|');
        const row = h2h.get(key) || { franchiseA: ordered[0], franchiseB: ordered[1], aWins: 0, bWins: 0, ties: 0 };
        if (a.points === b.points) row.ties += 1;
        else {
          const winner = a.points > b.points ? aId : bId;
          if (winner === row.franchiseA) row.aWins += 1; else row.bWins += 1;
        }
        h2h.set(key, row);
      }
    }
  }
  return {
    providers: Array.from(new Set(seasons.map((row) => row.provider))),
    franchises: Array.from(franchiseMap.values()).map((row) => ({ ...row, seasons: row.seasons.sort((a, b) => a - b) })).sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor),
    headToHead: Array.from(h2h.values()),
    topScoringWeeks: scoringWeeks.sort((a, b) => b.points - a.points).slice(0, 25),
    seasons: seasons.map((row) => ({ season: row.season, provider: row.provider })).sort((a, b) => b.season - a.season),
  };
}

export async function getFantasyHistorySummaryResult(
  leagueId: string,
): Promise<ReliabilityCacheResult<FantasyHistorySummary>> {
  return readThroughReliabilityCache({
    key: reliabilityKey('fantasy', 'history-summary', leagueId),
    freshForSeconds: 60 * 60,
    staleForSeconds: 30 * 24 * 60 * 60,
    load: () => loadFantasyHistorySummary(leagueId),
  });
}

export async function getFantasyHistorySummary(leagueId: string): Promise<FantasyHistorySummary> {
  return (await getFantasyHistorySummaryResult(leagueId)).value;
}

export async function getFantasyDraftHistory(leagueId: string): Promise<Array<{ season: number; provider: FantasyProviderId; results: ProviderDraftResult[] }>> {
  const seasons = await listLeagueProviderSeasons(leagueId);
  const output: Array<{ season: number; provider: FantasyProviderId; results: ProviderDraftResult[] }> = [];
  for (const mapped of seasons) {
    if (mapped.provider !== 'yahoo' || !mapped.id) continue;
    const cached = await readProviderSnapshot<ProviderDraftResult[]>(mapped.id, 'draft-results').catch(() => null);
    if (snapshotIsFresh(cached, 30 * 24 * 60 * 60 * 1000)) {
      output.push({ season: mapped.season, provider: mapped.provider, results: cached!.payload });
      continue;
    }
    try {
      const accessToken = await getFreshYahooAccessTokenForLeague(leagueId);
      const results = await getYahooLeagueDraftResults(accessToken, mapped.providerLeagueId);
      await writeProviderSnapshot(mapped.id, 'draft-results', results, 30 * 24 * 60 * 60 * 1000).catch(() => {});
      output.push({ season: mapped.season, provider: mapped.provider, results });
    } catch {
      if (cached) output.push({ season: mapped.season, provider: mapped.provider, results: cached.payload });
    }
  }
  return output.sort((a, b) => b.season - a.season);
}
