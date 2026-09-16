import { getLeague as getSleeperLeague, getLeagueDrafts } from '@/lib/utils/sleeper-api';
import { getLeagueById } from '@/lib/server/league-context';
import { resolveLeagueProviderSeason } from '@/lib/server/provider-seasons';
import { getFreshYahooAccessTokenForLeague } from '@/lib/server/provider-accounts';
import { readProviderSnapshot, snapshotIsFresh, writeProviderSnapshot } from '@/lib/server/provider-snapshots';
import { getYahooLeagueSettings, type YahooLeagueSettings } from '@/lib/providers/yahoo-settings';
import type { FantasyProviderId } from '@/lib/providers/types';

export type FantasyLeagueSettings = {
  provider: FantasyProviderId;
  season: string;
  teamCount: number | null;
  playoffTeams: number | null;
  playoffStartWeek: number | null;
  regularSeasonWeeks: number | null;
  rosterPositions: string[];
  starterSlots: string[];
  scoringSettings: Record<string, number>;
  ppr: number | null;
  superflex: boolean | null;
  draftRounds: number | null;
  waiverBudget: number | null;
  usesFaab: boolean;
  canTradeDraftPicks: boolean;
};

function positiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function finiteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function configNumber(config: Record<string, unknown>, candidates: string[]): number | null {
  for (const candidate of candidates) {
    const path = candidate.split('.');
    let value: unknown = config;
    for (const key of path) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        value = undefined;
        break;
      }
      value = (value as Record<string, unknown>)[key];
    }
    const parsed = positiveInt(value);
    if (parsed != null) return parsed;
  }
  return null;
}

function yahooSlot(position: string): string | null {
  const slot = position.toUpperCase();
  if (['BN', 'IR', 'IR+', 'NA', 'IL', 'DL'].includes(slot)) return null;
  if (slot === 'Q/W/R/T' || slot === 'Q/W/R' || slot === 'OP') return 'SUPER_FLEX';
  if (slot === 'W/R/T' || slot === 'W/R' || slot === 'W/T' || slot === 'R/W/T') return 'FLEX';
  if (slot === 'DEF' || slot === 'D/ST') return 'DEF';
  return slot;
}

function expandYahooPositions(settings: YahooLeagueSettings): { rosterPositions: string[]; starterSlots: string[] } {
  const rosterPositions: string[] = [];
  const starterSlots: string[] = [];
  for (const row of settings.rosterPositions) {
    for (let index = 0; index < row.count; index += 1) {
      rosterPositions.push(row.position);
      const starter = yahooSlot(row.position);
      if (starter) starterSlots.push(starter);
    }
  }
  return { rosterPositions, starterSlots };
}

export async function getFantasyLeagueSettings(
  leagueId: string,
  requestedSeason?: string | number | null,
): Promise<FantasyLeagueSettings> {
  const mapped = await resolveLeagueProviderSeason(leagueId, requestedSeason);
  if (!mapped) throw new Error('No fantasy provider is configured for this league season.');
  const dbLeague = await getLeagueById(leagueId);
  const config = dbLeague?.config || {};
  const configuredRegularWeeks = configNumber(config, ['regularSeasonWeeks', 'season.regularSeasonWeeks']);
  const configuredDraftRounds = configNumber(config, ['draftRounds', 'draft.rounds', 'draftSettings.rounds', 'rookieDraft.rounds']);

  if (mapped.provider === 'sleeper') {
    const [league, drafts] = await Promise.all([
      getSleeperLeague(mapped.providerLeagueId),
      getLeagueDrafts(mapped.providerLeagueId).catch(() => []),
    ]);
    const settings = (league.settings || {}) as Record<string, unknown>;
    const rosterPositions = Array.isArray(league.roster_positions) ? league.roster_positions.filter(Boolean) : [];
    const starterSlots = rosterPositions.filter((slot) => slot !== 'BN');
    const playoffStartWeek = positiveInt(settings.playoff_week_start ?? settings.playoff_start_week);
    const playoffTeams = positiveInt(settings.playoff_teams);
    const teamCount = positiveInt(league.total_rosters);
    const ppr = finiteNumber((league.scoring_settings as Record<string, unknown> | undefined)?.rec);
    const draftRounds = configuredDraftRounds ?? positiveInt(drafts[0]?.settings?.rounds) ?? positiveInt(settings.draft_rounds);
    const waiverBudget = finiteNumber(settings.waiver_budget);
    return {
      provider: 'sleeper',
      season: String(mapped.season),
      teamCount,
      playoffTeams,
      playoffStartWeek,
      regularSeasonWeeks: configuredRegularWeeks ?? (playoffStartWeek ? Math.max(1, playoffStartWeek - 1) : null),
      rosterPositions,
      starterSlots,
      scoringSettings: Object.fromEntries(Object.entries(league.scoring_settings || {}).map(([key, value]) => [key, Number(value)]).filter(([, value]) => Number.isFinite(value))),
      ppr,
      superflex: rosterPositions.includes('SUPER_FLEX') || rosterPositions.filter((slot) => slot === 'QB').length > 1,
      draftRounds,
      waiverBudget,
      usesFaab: waiverBudget != null && waiverBudget > 0,
      canTradeDraftPicks: true,
    };
  }

  const cached = mapped.id ? await readProviderSnapshot<YahooLeagueSettings>(mapped.id, 'settings').catch(() => null) : null;
  let yahoo = cached?.payload || null;
  if (!yahoo || !snapshotIsFresh(cached, 24 * 60 * 60 * 1000)) {
    try {
      const token = await getFreshYahooAccessTokenForLeague(leagueId);
      yahoo = await getYahooLeagueSettings(token, mapped.providerLeagueId);
      if (mapped.id) await writeProviderSnapshot(mapped.id, 'settings', yahoo, 24 * 60 * 60 * 1000).catch(() => {});
    } catch (error) {
      if (!yahoo) throw error;
    }
  }
  if (!yahoo) throw new Error('Yahoo league settings are not available yet.');
  const positions = expandYahooPositions(yahoo);
  return {
    provider: 'yahoo',
    season: String(mapped.season),
    teamCount: yahoo.teamCount,
    playoffTeams: yahoo.playoffTeams,
    playoffStartWeek: yahoo.playoffStartWeek,
    regularSeasonWeeks: configuredRegularWeeks ?? (yahoo.playoffStartWeek ? Math.max(1, yahoo.playoffStartWeek - 1) : null),
    rosterPositions: positions.rosterPositions,
    starterSlots: positions.starterSlots,
    scoringSettings: yahoo.scoringSettings,
    ppr: yahoo.ppr,
    superflex: yahoo.superflex,
    draftRounds: configuredDraftRounds,
    waiverBudget: yahoo.waiverBudget,
    usesFaab: yahoo.usesFaab,
    canTradeDraftPicks: yahoo.canTradeDraftPicks,
  };
}
