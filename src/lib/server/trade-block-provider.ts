import { getCurrentPhase } from '@/lib/utils/phase-resolver';
import { getLeague, getLeagueRosters } from '@/lib/utils/sleeper-api';
import { getFantasyRosters, getFantasyTransactionsForSeason } from '@/lib/server/fantasy-data';
import { getFantasyLeagueSettings } from '@/lib/server/provider-settings';
import { resolveLeagueProviderSeason } from '@/lib/server/provider-seasons';
import type { FantasyProviderId } from '@/lib/providers/types';
import type { TradeAsset, TradeBlockLeague, TradeBlockTeam } from '@/lib/server/trade-block-store';

export type TeamAssets = {
  players: string[];
  picks: Array<{ year: number; round: number; originalTeam: string }>;
  faab: number;
};

type SleeperTradedPick = {
  season?: string;
  round?: number;
  roster_id?: number;
  owner_id?: number;
};

type ProviderSeasonRef = {
  provider: FantasyProviderId;
  providerLeagueId: string;
  season: number;
};

export type TradeBlockLeagueContext = {
  league: TradeBlockLeague;
  provider: FantasyProviderId;
  season: number;
  teams: TradeBlockTeam[];
  seasons: number[];
  rounds: number;
  waiverBudget: number | null;
  rosterPlayers: Map<number, string[]>;
  faabByRoster: Map<number, number>;
  pickOwners: Map<string, number>;
  rosterIds: number[];
};

export type TradeBlockProviderDeps = {
  getLeague: typeof getLeague;
  getLeagueRosters: typeof getLeagueRosters;
  fetchImpl: typeof fetch;
  resolveProviderSeason?: (leagueId: string) => Promise<ProviderSeasonRef | null>;
  getFantasyRosters?: typeof getFantasyRosters;
  getFantasyLeagueSettings?: typeof getFantasyLeagueSettings;
  getFantasyTransactionsForSeason?: typeof getFantasyTransactionsForSeason;
};

const defaultDeps: TradeBlockProviderDeps = {
  getLeague,
  getLeagueRosters,
  fetchImpl: fetch,
  resolveProviderSeason: async (leagueId) => {
    const mapped = await resolveLeagueProviderSeason(leagueId);
    return mapped ? { provider: mapped.provider, providerLeagueId: mapped.providerLeagueId, season: mapped.season } : null;
  },
  getFantasyRosters,
  getFantasyLeagueSettings,
  getFantasyTransactionsForSeason,
};

export class TradeBlockProviderError extends Error {
  code: 'provider_not_configured' | 'provider_unavailable';
  status: 409 | 502;

  constructor(code: TradeBlockProviderError['code'], message: string, status: TradeBlockProviderError['status']) {
    super(message);
    this.name = 'TradeBlockProviderError';
    this.code = code;
    this.status = status;
  }
}

function finitePositive(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function resolveContextProvider(
  league: TradeBlockLeague,
  deps: TradeBlockProviderDeps,
): Promise<ProviderSeasonRef | null> {
  if (deps.resolveProviderSeason) return deps.resolveProviderSeason(league.id);

  // Dependency-injected unit tests predate provider seasons. Preserve that seam
  // without letting production fall back from a Yahoo league to a stale Sleeper ID.
  const sleeperLeagueId = String(league.sleeperLeagueId || '').trim();
  return sleeperLeagueId
    ? { provider: 'sleeper', providerLeagueId: sleeperLeagueId, season: 0 }
    : null;
}

async function sleeperContext(
  league: TradeBlockLeague,
  teams: TradeBlockTeam[],
  providerLeagueId: string,
  deps: TradeBlockProviderDeps,
): Promise<TradeBlockLeagueContext> {
  let providerLeague: Awaited<ReturnType<typeof getLeague>>;
  let rosters: Awaited<ReturnType<typeof getLeagueRosters>>;
  try {
    [providerLeague, rosters] = await Promise.all([
      deps.getLeague(providerLeagueId),
      deps.getLeagueRosters(providerLeagueId),
    ]);
  } catch (error) {
    console.error('[trade-block] Sleeper league/roster request failed', { leagueId: league.id, providerLeagueId, error });
    throw new TradeBlockProviderError('provider_unavailable', 'Sleeper data is temporarily unavailable.', 502);
  }

  const season = finitePositive(providerLeague.season, new Date().getFullYear());
  const phase = getCurrentPhase();
  const firstPickSeason = phase === 'post_championship_pre_draft' ? season : season + 1;
  const seasons = [firstPickSeason, firstPickSeason + 1, firstPickSeason + 2];
  const settings = providerLeague.settings || {};
  const rounds = Math.max(1, Math.min(20, finitePositive(settings.draft_rounds, 4)));
  const waiverBudget = Math.max(0, finitePositive(settings.waiver_budget, 100));

  let tradedPicks: SleeperTradedPick[] = [];
  try {
    const response = await deps.fetchImpl(
      `https://api.sleeper.app/v1/league/${encodeURIComponent(providerLeagueId)}/traded_picks`,
      { cache: 'no-store' },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    tradedPicks = Array.isArray(body) ? body as SleeperTradedPick[] : [];
  } catch (error) {
    console.error('[trade-block] Sleeper traded-picks request failed', { leagueId: league.id, providerLeagueId, error });
    throw new TradeBlockProviderError('provider_unavailable', 'Sleeper draft-pick data is temporarily unavailable.', 502);
  }

  const rosterIds = rosters.map((roster) => roster.roster_id);
  const rosterIdSet = new Set(rosterIds);
  const pickOwners = new Map<string, number>();
  for (const year of seasons) {
    for (const roster of rosters) {
      for (let round = 1; round <= rounds; round += 1) {
        pickOwners.set(`${year}-${roster.roster_id}-${round}`, roster.roster_id);
      }
    }
  }
  for (const pick of tradedPicks) {
    const year = Number(pick.season);
    const round = Number(pick.round);
    const original = Number(pick.roster_id);
    const owner = Number(pick.owner_id);
    if (!seasons.includes(year) || !Number.isFinite(round) || round < 1 || round > rounds) continue;
    if (!rosterIdSet.has(original) || !rosterIdSet.has(owner)) continue;
    pickOwners.set(`${year}-${original}-${round}`, owner);
  }

  const rosterPlayers = new Map<number, string[]>();
  const faabByRoster = new Map<number, number>();
  for (const roster of rosters) {
    rosterPlayers.set(roster.roster_id, Array.isArray(roster.players) ? roster.players.filter(Boolean) : []);
    const used = Number(roster.settings?.waiver_budget_used ?? 0);
    faabByRoster.set(roster.roster_id, Math.max(0, waiverBudget - (Number.isFinite(used) ? used : 0)));
  }

  return {
    league,
    provider: 'sleeper',
    season,
    teams,
    seasons,
    rounds,
    waiverBudget,
    rosterPlayers,
    faabByRoster,
    pickOwners,
    rosterIds,
  };
}

async function yahooContext(
  league: TradeBlockLeague,
  teams: TradeBlockTeam[],
  season: number,
  deps: TradeBlockProviderDeps,
): Promise<TradeBlockLeagueContext> {
  const loadRosters = deps.getFantasyRosters || getFantasyRosters;
  const loadSettings = deps.getFantasyLeagueSettings || getFantasyLeagueSettings;
  const loadTransactions = deps.getFantasyTransactionsForSeason || getFantasyTransactionsForSeason;

  try {
    const [rosters, settings, transactions] = await Promise.all([
      loadRosters(league.id, season),
      loadSettings(league.id, season),
      loadTransactions(league.id, season).catch(() => []),
    ]);
    const rosterPlayers = new Map(rosters.teams.map((team) => [team.rosterId, team.players] as const));
    const rosterIds = rosters.teams.map((team) => team.rosterId);
    const faabByRoster = new Map<number, number>();

    if (settings.usesFaab && settings.waiverBudget != null) {
      for (const team of rosters.teams) {
        const spent = transactions
          .filter((txn) => txn.rosterId === team.rosterId && txn.type === 'waiver')
          .reduce((sum, txn) => sum + Math.max(0, Number(txn.faab || 0)), 0);
        faabByRoster.set(team.rosterId, Math.max(0, settings.waiverBudget - spent));
      }
    }

    return {
      league,
      provider: 'yahoo',
      season,
      teams,
      seasons: [],
      rounds: settings.draftRounds || 0,
      waiverBudget: settings.usesFaab ? settings.waiverBudget : null,
      rosterPlayers,
      faabByRoster,
      pickOwners: new Map(),
      rosterIds,
    };
  } catch (error) {
    console.error('[trade-block] Yahoo roster request failed', { leagueId: league.id, error });
    throw new TradeBlockProviderError('provider_unavailable', 'Yahoo roster data is temporarily unavailable.', 502);
  }
}

export async function loadTradeBlockLeagueContext(
  league: TradeBlockLeague,
  teams: TradeBlockTeam[],
  deps: TradeBlockProviderDeps = defaultDeps,
): Promise<TradeBlockLeagueContext> {
  const mapped = await resolveContextProvider(league, deps).catch(() => null);
  if (!mapped) {
    throw new TradeBlockProviderError(
      'provider_not_configured',
      `${league.name || 'This league'} does not have a fantasy provider configured.`,
      409,
    );
  }
  if (mapped.provider === 'yahoo') return yahooContext(league, teams, mapped.season, deps);
  return sleeperContext(league, teams, mapped.providerLeagueId, deps);
}

export function teamAssetsFromContext(
  teamName: string,
  rosterId: number | null | undefined,
  ctx: TradeBlockLeagueContext,
): TeamAssets {
  const team = ctx.teams.find((entry) => entry.team === teamName);
  const resolvedRosterId = rosterId ?? team?.rosterId ?? null;
  const players = resolvedRosterId == null ? [] : (ctx.rosterPlayers.get(resolvedRosterId) || []);
  const faab = resolvedRosterId == null ? 0 : (ctx.faabByRoster.get(resolvedRosterId) || 0);

  const teamByRosterId = new Map<number, string>();
  for (const entry of ctx.teams) if (entry.rosterId != null) teamByRosterId.set(entry.rosterId, entry.team);

  const picks: TeamAssets['picks'] = [];
  if (ctx.provider === 'sleeper' && resolvedRosterId != null) {
    for (const year of ctx.seasons) {
      for (const originalRosterId of ctx.rosterIds) {
        const originalTeam = teamByRosterId.get(originalRosterId);
        if (!originalTeam) continue;
        for (let round = 1; round <= ctx.rounds; round += 1) {
          const owner = ctx.pickOwners.get(`${year}-${originalRosterId}-${round}`) ?? originalRosterId;
          if (owner === resolvedRosterId) picks.push({ year, round, originalTeam });
        }
      }
    }
  }

  picks.sort((a, b) => a.year - b.year || a.round - b.round || a.originalTeam.localeCompare(b.originalTeam));
  return { players, picks, faab };
}

export function sanitizeTradeBlock(requested: TradeAsset[], assets: TeamAssets): TradeAsset[] {
  const players = new Set(assets.players);
  const exactPicks = new Map(assets.picks.map((pick) => [`${pick.year}-${pick.round}-${pick.originalTeam}`, pick] as const));
  const byYearRound = new Map<string, TeamAssets['picks'][number]>();
  for (const pick of assets.picks) {
    const key = `${pick.year}-${pick.round}`;
    if (!byYearRound.has(key)) byYearRound.set(key, pick);
  }

  const result: TradeAsset[] = [];
  const seen = new Set<string>();
  for (const item of requested.slice(0, 200)) {
    if (!item || typeof item !== 'object') continue;
    if (item.type === 'player') {
      if (!item.playerId || !players.has(item.playerId)) continue;
      const key = `player:${item.playerId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ type: 'player', playerId: item.playerId });
      continue;
    }
    if (item.type === 'pick') {
      const year = Number(item.year);
      const round = Number(item.round);
      if (!Number.isFinite(year) || !Number.isFinite(round)) continue;
      const requestedOrigin = typeof item.originalTeam === 'string' ? item.originalTeam : '';
      const owned = requestedOrigin
        ? exactPicks.get(`${year}-${round}-${requestedOrigin}`)
        : byYearRound.get(`${year}-${round}`);
      if (!owned) continue;
      const key = `pick:${owned.year}-${owned.round}-${owned.originalTeam}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ type: 'pick', ...owned });
      continue;
    }
    if (item.type === 'faab') {
      const amount = Number(item.amount ?? assets.faab);
      const safe = Math.max(0, Math.min(assets.faab, Number.isFinite(amount) ? amount : 0));
      if (safe <= 0 || seen.has('faab')) continue;
      seen.add('faab');
      result.push({ type: 'faab', amount: safe });
    }
  }
  return result;
}
