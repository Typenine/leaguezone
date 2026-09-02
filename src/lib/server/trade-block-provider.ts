import { getCurrentPhase } from '@/lib/utils/phase-resolver';
import {
  getLeague,
  getLeagueRosters,
  type SleeperLeague,
  type SleeperRoster,
} from '@/lib/utils/sleeper-api';
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

export type TradeBlockLeagueContext = {
  league: TradeBlockLeague;
  providerLeague: SleeperLeague;
  rosters: SleeperRoster[];
  teams: TradeBlockTeam[];
  seasons: number[];
  rounds: number;
  waiverBudget: number;
  pickOwners: Map<string, number>;
};

export type TradeBlockProviderDeps = {
  getLeague: typeof getLeague;
  getLeagueRosters: typeof getLeagueRosters;
  fetchImpl: typeof fetch;
};

const defaultDeps: TradeBlockProviderDeps = {
  getLeague,
  getLeagueRosters,
  fetchImpl: fetch,
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

export async function loadTradeBlockLeagueContext(
  league: TradeBlockLeague,
  teams: TradeBlockTeam[],
  deps: TradeBlockProviderDeps = defaultDeps,
): Promise<TradeBlockLeagueContext> {
  const sleeperLeagueId = String(league.sleeperLeagueId || '').trim();
  if (!sleeperLeagueId) {
    throw new TradeBlockProviderError(
      'provider_not_configured',
      `${league.name || 'This league'} does not have a Sleeper league ID configured.`,
      409,
    );
  }

  let providerLeague: SleeperLeague;
  let rosters: SleeperRoster[];
  try {
    [providerLeague, rosters] = await Promise.all([
      deps.getLeague(sleeperLeagueId),
      deps.getLeagueRosters(sleeperLeagueId),
    ]);
  } catch (error) {
    console.error('[trade-block] Sleeper league/roster request failed', { leagueId: league.id, sleeperLeagueId, error });
    throw new TradeBlockProviderError('provider_unavailable', 'Sleeper data is temporarily unavailable.', 502);
  }

  const currentSeason = finitePositive(providerLeague.season, new Date().getFullYear());
  const phase = getCurrentPhase();
  const firstPickSeason = phase === 'post_championship_pre_draft' ? currentSeason : currentSeason + 1;
  const seasons = [firstPickSeason, firstPickSeason + 1, firstPickSeason + 2];
  const settings = providerLeague.settings || {};
  const rounds = Math.max(1, Math.min(20, finitePositive(settings.draft_rounds, 4)));
  const waiverBudget = Math.max(0, finitePositive(settings.waiver_budget, 100));

  let tradedPicks: SleeperTradedPick[] = [];
  try {
    const response = await deps.fetchImpl(
      `https://api.sleeper.app/v1/league/${encodeURIComponent(sleeperLeagueId)}/traded_picks`,
      { cache: 'no-store' },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    tradedPicks = Array.isArray(body) ? body as SleeperTradedPick[] : [];
  } catch (error) {
    console.error('[trade-block] Sleeper traded-picks request failed', { leagueId: league.id, sleeperLeagueId, error });
    throw new TradeBlockProviderError('provider_unavailable', 'Sleeper draft-pick data is temporarily unavailable.', 502);
  }

  const rosterIds = new Set(rosters.map((roster) => roster.roster_id));
  const pickOwners = new Map<string, number>();
  for (const season of seasons) {
    for (const roster of rosters) {
      for (let round = 1; round <= rounds; round++) {
        pickOwners.set(`${season}-${roster.roster_id}-${round}`, roster.roster_id);
      }
    }
  }

  for (const pick of tradedPicks) {
    const season = Number(pick.season);
    const round = Number(pick.round);
    const originalRosterId = Number(pick.roster_id);
    const ownerRosterId = Number(pick.owner_id);
    if (!seasons.includes(season) || !Number.isFinite(round) || round < 1 || round > rounds) continue;
    if (!rosterIds.has(originalRosterId) || !rosterIds.has(ownerRosterId)) continue;
    pickOwners.set(`${season}-${originalRosterId}-${round}`, ownerRosterId);
  }

  return {
    league,
    providerLeague,
    rosters,
    teams,
    seasons,
    rounds,
    waiverBudget,
    pickOwners,
  };
}

export function teamAssetsFromContext(
  teamName: string,
  rosterId: number | null | undefined,
  ctx: TradeBlockLeagueContext,
): TeamAssets {
  const team = ctx.teams.find((entry) => entry.team === teamName);
  const resolvedRosterId = rosterId ?? team?.rosterId ?? null;
  const roster = resolvedRosterId == null
    ? undefined
    : ctx.rosters.find((entry) => entry.roster_id === resolvedRosterId);

  const players = Array.isArray(roster?.players) ? roster.players.filter(Boolean) : [];
  const used = Number(roster?.settings?.waiver_budget_used ?? 0);
  const faab = Math.max(0, ctx.waiverBudget - (Number.isFinite(used) ? used : 0));

  const teamByRosterId = new Map<number, string>();
  for (const entry of ctx.teams) {
    if (entry.rosterId != null) teamByRosterId.set(entry.rosterId, entry.team);
  }

  const picks: TeamAssets['picks'] = [];
  if (resolvedRosterId != null) {
    for (const season of ctx.seasons) {
      for (const originalRoster of ctx.rosters) {
        const originalTeam = teamByRosterId.get(originalRoster.roster_id);
        if (!originalTeam) continue;
        for (let round = 1; round <= ctx.rounds; round++) {
          const owner = ctx.pickOwners.get(`${season}-${originalRoster.roster_id}-${round}`) ?? originalRoster.roster_id;
          if (owner === resolvedRosterId) {
            picks.push({ year: season, round, originalTeam });
          }
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
      if (seen.has('faab')) continue;
      seen.add('faab');
      result.push({ type: 'faab', amount: safe });
    }
  }
  return result;
}
