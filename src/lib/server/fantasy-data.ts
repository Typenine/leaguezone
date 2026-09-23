import type {
  FantasyMatchup,
  FantasyPlayer,
  FantasyRostersData,
  FantasyStandingsData,
  FantasyTeamData,
  FantasyTransaction,
  ProviderTeamSummary,
} from '@/lib/providers/types';
import { getYahooLeagueTeams, isYahooAvailable } from '@/lib/providers/yahoo';
import {
  getYahooLeagueScoreboard,
  getYahooLeagueStandings,
  getYahooLeagueTransactions,
  getYahooTeamRoster,
} from '@/lib/providers/yahoo-data';
import { getFreshYahooAccessTokenForLeague } from '@/lib/server/provider-accounts';
import {
  listLeagueProviderSeasons,
  resolveLeagueProviderSeason,
  type LeagueProviderSeason,
} from '@/lib/server/provider-seasons';
import { readThroughReliabilityCache, reliabilityKey, type ReliabilityCacheResult } from '@/lib/server/reliability-cache';
import {
  readProviderSnapshot,
  snapshotIsFresh,
  writeProviderSnapshot,
} from '@/lib/server/provider-snapshots';
import {
  getAllPlayersCached,
  getCurrentStreaksForLeague,
  getLeagueMatchups,
  getLeagueTransactionsAllWeeks,
  getLeagueUsers,
  getNFLState,
  getRosterIdToTeamNameMap,
  getTeamsData,
  type SleeperPlayer,
  type SleeperTransaction,
} from '@/lib/utils/sleeper-api';

const TTL = {
  teams: 60 * 60 * 1000,
  standings: 5 * 60 * 1000,
  rosters: 10 * 60 * 1000,
  matchupsCurrent: 2 * 60 * 1000,
  matchupsHistorical: 24 * 60 * 60 * 1000,
  transactions: 5 * 60 * 1000,
};

function requireMappedSeason(season: LeagueProviderSeason | null): LeagueProviderSeason {
  if (!season) throw new Error('No fantasy provider is configured for that LeagueZone season.');
  return season;
}

async function yahooSnapshot<T>(
  season: LeagueProviderSeason,
  snapshotType: string,
  ttlMs: number,
  refresh: (accessToken: string) => Promise<T>,
): Promise<T> {
  const cached = season.id ? await readProviderSnapshot<T>(season.id, snapshotType).catch(() => null) : null;
  if (snapshotIsFresh(cached, ttlMs)) return cached!.payload;
  if (isYahooAvailable() && season.id) {
    try {
      const accessToken = await getFreshYahooAccessTokenForLeague(season.leagueId);
      const payload = await refresh(accessToken);
      await writeProviderSnapshot(season.id, snapshotType, payload, ttlMs).catch(() => {});
      return payload;
    } catch (error) {
      if (!cached) throw error;
    }
  }
  if (cached) return cached.payload;
  throw new Error('Yahoo data is not available yet. The commissioner may need to reconnect Yahoo.');
}

function normalizeYahooTeamSummaries(raw: ProviderTeamSummary[]): ProviderTeamSummary[] {
  return raw.map((team) => ({ ...team, ownerId: team.ownerId || team.providerTeamId, ownerName: team.ownerName || `Manager ${team.rosterId}` }));
}

function sleeperPlayerToFantasy(playerId: string, player: SleeperPlayer | undefined): FantasyPlayer {
  const firstName = player?.first_name || null;
  const lastName = player?.last_name || null;
  return {
    provider: 'sleeper', playerId, providerPlayerId: playerId, firstName, lastName,
    fullName: [firstName, lastName].filter(Boolean).join(' ').trim() || playerId,
    position: player?.position || null, nflTeam: player?.team || null,
  };
}

async function sleeperStandings(season: LeagueProviderSeason): Promise<FantasyStandingsData> {
  const [teams, streaks, users] = await Promise.all([
    getTeamsData(season.providerLeagueId),
    getCurrentStreaksForLeague(season.providerLeagueId).catch(() => ({})),
    getLeagueUsers(season.providerLeagueId).catch(() => []),
  ]);
  const ownerNames = new Map(users.map((user) => [user.user_id, user.display_name || user.username || null] as const));
  return {
    provider: 'sleeper', season: String(season.season),
    teams: teams.map((team) => ({
      providerTeamId: String(team.rosterId), rosterId: team.rosterId, teamName: team.teamName,
      ownerId: team.ownerId, ownerName: ownerNames.get(team.ownerId) ?? null, logoUrl: null,
      wins: team.wins, losses: team.losses, ties: team.ties, fpts: team.fpts,
      fptsAgainst: team.fptsAgainst, players: team.players || [],
    })),
    streaks,
  };
}

async function loadFantasyStandings(leagueId: string, season?: string | number | null): Promise<FantasyStandingsData> {
  const mapped = requireMappedSeason(await resolveLeagueProviderSeason(leagueId, season));
  if (mapped.provider === 'sleeper') return sleeperStandings(mapped);
  const standings = await yahooSnapshot(mapped, 'standings', TTL.standings, async (accessToken) => getYahooLeagueStandings(accessToken, mapped.providerLeagueId));
  return { provider: 'yahoo', season: String(mapped.season), teams: standings.teams, streaks: standings.streaks };
}

export async function getFantasyStandingsResult(
  leagueId: string,
  season?: string | number | null,
): Promise<ReliabilityCacheResult<FantasyStandingsData>> {
  return readThroughReliabilityCache({
    key: reliabilityKey('fantasy', 'standings', leagueId, season == null ? 'current' : String(season)),
    freshForSeconds: 2 * 60,
    staleForSeconds: 7 * 24 * 60 * 60,
    load: () => loadFantasyStandings(leagueId, season),
  });
}

export async function getFantasyStandings(leagueId: string, season?: string | number | null): Promise<FantasyStandingsData> {
  return (await getFantasyStandingsResult(leagueId, season)).value;
}

async function sleeperRosters(season: LeagueProviderSeason): Promise<FantasyRostersData> {
  const [standings, allPlayers] = await Promise.all([
    sleeperStandings(season),
    getAllPlayersCached().catch(() => ({} as Record<string, SleeperPlayer>)),
  ]);
  const rosteredIds = new Set(standings.teams.flatMap((team) => team.players || []));
  const players: Record<string, FantasyPlayer> = {};
  for (const playerId of rosteredIds) players[playerId] = sleeperPlayerToFantasy(playerId, allPlayers[playerId]);
  return { provider: 'sleeper', season: String(season.season), teams: standings.teams, players };
}

async function loadFantasyRosters(leagueId: string, season?: string | number | null): Promise<FantasyRostersData> {
  const mapped = requireMappedSeason(await resolveLeagueProviderSeason(leagueId, season));
  if (mapped.provider === 'sleeper') return sleeperRosters(mapped);
  return yahooSnapshot<FantasyRostersData>(mapped, 'rosters', TTL.rosters, async (accessToken) => {
    const [teamSummaries, standings] = await Promise.all([
      getYahooLeagueTeams(accessToken, mapped.providerLeagueId).then(normalizeYahooTeamSummaries),
      getYahooLeagueStandings(accessToken, mapped.providerLeagueId),
    ]);
    const rosterSnapshots = await Promise.all(teamSummaries.map((team) => getYahooTeamRoster(accessToken, team.providerTeamId)));
    const standingsByRoster = new Map(standings.teams.map((team) => [team.rosterId, team] as const));
    const players: Record<string, FantasyPlayer> = {};
    const teams: FantasyTeamData[] = teamSummaries.map((summary) => {
      const roster = rosterSnapshots.find((item) => item.providerTeamId === summary.providerTeamId);
      for (const player of roster?.players || []) players[player.playerId] = player;
      const record = standingsByRoster.get(summary.rosterId);
      return {
        providerTeamId: summary.providerTeamId, rosterId: summary.rosterId, teamName: summary.teamName,
        ownerId: summary.ownerId || summary.providerTeamId, ownerName: summary.ownerName || null, logoUrl: summary.logoUrl,
        wins: record?.wins ?? 0, losses: record?.losses ?? 0, ties: record?.ties ?? 0,
        fpts: record?.fpts ?? 0, fptsAgainst: record?.fptsAgainst ?? 0,
        players: (roster?.players || []).map((player) => player.playerId),
      };
    });
    return { provider: 'yahoo', season: String(mapped.season), teams, players };
  });
}

export async function getFantasyRostersResult(
  leagueId: string,
  season?: string | number | null,
): Promise<ReliabilityCacheResult<FantasyRostersData>> {
  return readThroughReliabilityCache({
    key: reliabilityKey('fantasy', 'rosters', leagueId, season == null ? 'current' : String(season)),
    freshForSeconds: 5 * 60,
    staleForSeconds: 7 * 24 * 60 * 60,
    load: () => loadFantasyRosters(leagueId, season),
  });
}

export async function getFantasyRosters(leagueId: string, season?: string | number | null): Promise<FantasyRostersData> {
  return (await getFantasyRostersResult(leagueId, season)).value;
}

function groupSleeperMatchups(
  season: LeagueProviderSeason,
  week: number,
  raw: Awaited<ReturnType<typeof getLeagueMatchups>>,
  names: Map<number, string>,
): FantasyMatchup[] {
  const groups = new Map<number, typeof raw>();
  for (const matchup of raw) {
    if (!matchup.matchup_id) continue;
    const current = groups.get(matchup.matchup_id) || [];
    current.push(matchup);
    groups.set(matchup.matchup_id, current);
  }
  return Array.from(groups.entries()).map(([matchupId, group]) => ({
    provider: 'sleeper' as const, season: String(season.season), week, matchupId,
    teams: group.map((team) => ({
      providerTeamId: String(team.roster_id), rosterId: team.roster_id,
      teamName: names.get(team.roster_id) || `Roster ${team.roster_id}`,
      points: team.custom_points ?? team.points ?? 0,
      starters: (team.starters || []).filter(Boolean), players: (team.players || []).filter(Boolean),
      playerPoints: (team.players_points || {}) as Record<string, number>,
    })),
  })).sort((a, b) => a.matchupId - b.matchupId);
}

async function loadFantasyMatchups(leagueId: string, week: number, season?: string | number | null): Promise<FantasyMatchup[]> {
  const mapped = requireMappedSeason(await resolveLeagueProviderSeason(leagueId, season));
  if (mapped.provider === 'sleeper') {
    const [raw, names] = await Promise.all([getLeagueMatchups(mapped.providerLeagueId, week), getRosterIdToTeamNameMap(mapped.providerLeagueId)]);
    return groupSleeperMatchups(mapped, week, raw, names);
  }
  return yahooSnapshot<FantasyMatchup[]>(mapped, `matchups:${week}`, mapped.isCurrent ? TTL.matchupsCurrent : TTL.matchupsHistorical, async (accessToken) => getYahooLeagueScoreboard(accessToken, mapped.providerLeagueId, String(mapped.season), week));
}

export async function getFantasyMatchups(leagueId: string, week: number, season?: string | number | null): Promise<FantasyMatchup[]> {
  const historical = season != null && String(season) !== String(new Date().getUTCFullYear());
  return (await readThroughReliabilityCache({
    key: reliabilityKey('fantasy', 'matchups', leagueId, season == null ? 'current' : String(season), week),
    freshForSeconds: historical ? 24 * 60 * 60 : 2 * 60,
    staleForSeconds: historical ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60,
    load: () => loadFantasyMatchups(leagueId, week, season),
  })).value;
}

export async function getFantasyCurrentWeek(): Promise<number> {
  const state = await getNFLState().catch(() => null);
  const week = Number(state?.week ?? state?.display_week ?? 1);
  return Number.isFinite(week) && week > 0 ? Math.min(18, week) : 1;
}

function buildSleeperPlayerRecord(playerId: string, player: SleeperPlayer | undefined) {
  if (!player) return { playerId, name: null, position: null, nflTeam: null };
  const name = `${player.first_name || ''} ${player.last_name || ''}`.trim() || null;
  return { playerId, name, position: player.position || null, nflTeam: player.team || null };
}
function resolveSleeperWaiverBid(txn: SleeperTransaction, rosterId: number): number {
  if (txn.type !== 'waiver') return 0;
  const settingsBid = Number((txn.settings as { waiver_bid?: number })?.waiver_bid ?? 0);
  if (Number.isFinite(settingsBid) && settingsBid > 0) return settingsBid;
  const metadataBid = Number((txn.metadata as { waiver_bid?: number })?.waiver_bid ?? 0);
  if (Number.isFinite(metadataBid) && metadataBid > 0) return metadataBid;
  if (Array.isArray(txn.waiver_budget)) {
    const transfer = txn.waiver_budget.find((budget) => budget.receiver === rosterId);
    if (transfer && Number.isFinite(Number(transfer.amount))) return Number(transfer.amount);
  }
  return 0;
}

async function sleeperTransactions(season: LeagueProviderSeason): Promise<FantasyTransaction[]> {
  const [players, transactions, rosterNameMap] = await Promise.all([
    getAllPlayersCached().catch(() => ({} as Record<string, SleeperPlayer>)),
    getLeagueTransactionsAllWeeks(season.providerLeagueId, { forceFresh: true }).catch(() => [] as SleeperTransaction[]),
    getRosterIdToTeamNameMap(season.providerLeagueId, { forceFresh: true }).catch(() => new Map<number, string>()),
  ]);
  const chunk: FantasyTransaction[] = [];
  for (const txn of transactions) {
    const status = String((txn as unknown as { status?: unknown }).status ?? '').trim().toLowerCase();
    if (status !== 'complete' && status !== 'completed') continue;
    if (txn.type === 'waiver' || txn.type === 'free_agent') {
      const adds = Object.entries(txn.adds || {}); if (adds.length === 0) continue; const drops = Object.entries(txn.drops || {});
      for (const [playerId, rosterId] of adds) {
        const teamName = rosterNameMap.get(rosterId) || `Roster ${rosterId}`;
        chunk.push({
          id: txn.transaction_id, type: txn.type, season: String(season.season), week: Number(txn.leg ?? 0) || 0,
          created: Number(txn.created ?? 0) || 0, team: teamName, teamsInvolved: [teamName], rosterId,
          added: [buildSleeperPlayerRecord(playerId, players[playerId])],
          dropped: drops.filter(([, dropRosterId]) => dropRosterId === rosterId).map(([droppedId]) => buildSleeperPlayerRecord(droppedId, players[droppedId])),
          faab: resolveSleeperWaiverBid(txn, rosterId), metadata: txn.metadata || undefined,
        });
      }
      continue;
    }
    if (txn.type === 'trade') {
      const rosterIds = txn.roster_ids || []; const teamNames = rosterIds.map((id) => rosterNameMap.get(id) || `Roster ${id}`);
      const added: FantasyTransaction['added'] = []; const dropped: FantasyTransaction['dropped'] = [];
      for (const [playerId, rosterId] of Object.entries(txn.adds || {})) {
        const toTeam = rosterNameMap.get(rosterId) || `Roster ${rosterId}`; const record = buildSleeperPlayerRecord(playerId, players[playerId]);
        added.push({ ...record, name: record.name ? `${record.name} (to ${toTeam})` : `${playerId} (to ${toTeam})` });
      }
      for (const pick of txn.draft_picks || []) {
        const original = rosterNameMap.get(pick.roster_id) || `Roster ${pick.roster_id}`; const to = rosterNameMap.get(pick.owner_id) || `Roster ${pick.owner_id}`;
        added.push({ playerId: `pick-${pick.season}-${pick.round}-${pick.roster_id}-${pick.owner_id}`, name: `${pick.season} Round ${pick.round} pick (${original} → ${to})`, position: null, nflTeam: null });
      }
      for (const [playerId, rosterId] of Object.entries(txn.drops || {})) {
        const fromTeam = rosterNameMap.get(rosterId) || `Roster ${rosterId}`; const record = buildSleeperPlayerRecord(playerId, players[playerId]);
        dropped.push({ ...record, name: record.name ? `${record.name} (from ${fromTeam})` : `${playerId} (from ${fromTeam})` });
      }
      if (added.length === 0 && dropped.length === 0) continue;
      let faab = 0; for (const budget of txn.waiver_budget || []) faab += Number(budget.amount) || 0;
      chunk.push({ id: txn.transaction_id, type: 'trade', season: String(season.season), week: Number(txn.leg ?? 0) || 0, created: Number(txn.status_updated ?? txn.created ?? 0) || 0, team: teamNames.length ? teamNames.join(' · ') : 'Trade', teamsInvolved: teamNames, rosterId: rosterIds[0] ?? 0, added, dropped, faab, metadata: txn.metadata || undefined });
    }
  }
  return chunk.sort((a, b) => b.created - a.created);
}

async function loadFantasyTransactionsForSeason(leagueId: string, season: string | number): Promise<FantasyTransaction[]> {
  const mapped = requireMappedSeason(await resolveLeagueProviderSeason(leagueId, season));
  if (mapped.provider === 'sleeper') return sleeperTransactions(mapped);
  return yahooSnapshot<FantasyTransaction[]>(mapped, 'transactions', TTL.transactions, async (accessToken) => getYahooLeagueTransactions(accessToken, mapped.providerLeagueId, String(mapped.season)));
}

export async function getFantasyTransactionsForSeason(leagueId: string, season: string | number): Promise<FantasyTransaction[]> {
  return (await readThroughReliabilityCache({
    key: reliabilityKey('fantasy', 'transactions', leagueId, String(season)),
    freshForSeconds: 5 * 60,
    staleForSeconds: 7 * 24 * 60 * 60,
    load: () => loadFantasyTransactionsForSeason(leagueId, season),
  })).value;
}

async function getTeamRecordsForMappedSeason(mapped: LeagueProviderSeason): Promise<FantasyTeamData[]> {
  if (mapped.provider === 'yahoo') return (await getFantasyStandings(mapped.leagueId, mapped.season)).teams;
  const [teams, users] = await Promise.all([getTeamsData(mapped.providerLeagueId), getLeagueUsers(mapped.providerLeagueId).catch(() => [])]);
  const ownerNames = new Map(users.map((user) => [user.user_id, user.display_name || user.username || null] as const));
  return teams.map((team) => ({
    providerTeamId: String(team.rosterId), rosterId: team.rosterId, teamName: team.teamName, ownerId: team.ownerId,
    ownerName: ownerNames.get(team.ownerId) ?? null, logoUrl: null, wins: team.wins, losses: team.losses, ties: team.ties,
    fpts: team.fpts, fptsAgainst: team.fptsAgainst, players: team.players || [],
  }));
}

async function loadFantasyTeamDirectory(leagueId: string): Promise<{
  provider: 'sleeper' | 'yahoo' | null;
  teams: FantasyTeamData[];
  allTimeByOwner: Record<string, { wins: number; losses: number; ties: number }>;
}> {
  const seasons = await listLeagueProviderSeasons(leagueId); const current = seasons.find((item) => item.isCurrent) || seasons[0];
  if (!current) return { provider: null, teams: [], allTimeByOwner: {} };
  const recordsBySeason = await Promise.all(seasons.map((item) => getTeamRecordsForMappedSeason(item).catch(() => [] as FantasyTeamData[])));
  const currentIndex = seasons.findIndex((item) => item.season === current.season); const currentTeams = currentIndex >= 0 ? recordsBySeason[currentIndex] : [];
  const allTimeByOwner: Record<string, { wins: number; losses: number; ties: number }> = {};
  for (const teams of recordsBySeason) for (const team of teams) {
    const key = team.ownerId || team.providerTeamId; const existing = allTimeByOwner[key] || { wins: 0, losses: 0, ties: 0 };
    existing.wins += team.wins; existing.losses += team.losses; existing.ties += team.ties; allTimeByOwner[key] = existing;
  }
  return { provider: current.provider, teams: currentTeams, allTimeByOwner };
}

export type FantasyTeamDirectoryData = Awaited<ReturnType<typeof loadFantasyTeamDirectory>>;

export async function getFantasyTeamDirectoryResult(
  leagueId: string,
): Promise<ReliabilityCacheResult<FantasyTeamDirectoryData>> {
  return readThroughReliabilityCache({
    key: reliabilityKey('fantasy', 'teams', leagueId),
    freshForSeconds: 15 * 60,
    staleForSeconds: 7 * 24 * 60 * 60,
    load: () => loadFantasyTeamDirectory(leagueId),
  });
}

export async function getFantasyTeamDirectory(leagueId: string): Promise<FantasyTeamDirectoryData> {
  return (await getFantasyTeamDirectoryResult(leagueId)).value;
}
