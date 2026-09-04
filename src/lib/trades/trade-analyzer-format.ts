import { getLeague, getLeagueDrafts } from '@/lib/utils/sleeper-api';

type LeagueForTradeAnalyzer = {
  sleeperLeagueId?: string | null;
};

export type TradeAnalyzerLeagueFormat = {
  superflex: boolean | null;
  teamCount: number | null;
  ppr: number | null;
  draftRounds: number | null;
  label: string | null;
};

function positiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function scoringLabel(ppr: number | null): string | null {
  if (ppr == null || !Number.isFinite(ppr)) return null;
  if (ppr === 0) return 'Standard';
  if (ppr === 0.5) return 'Half-PPR';
  if (ppr === 1) return 'PPR';
  return `${ppr} PPR`;
}

/**
 * Resolve the trade analyzer's league shape from the connected Sleeper league.
 * Drafts are returned newest-first by Sleeper, so the newest configured draft is
 * the best provider-backed source for the league's current draft round count.
 */
export async function resolveTradeAnalyzerLeagueFormat(
  league: LeagueForTradeAnalyzer | null | undefined,
): Promise<TradeAnalyzerLeagueFormat> {
  const leagueId = league?.sleeperLeagueId?.trim() || '';
  if (!leagueId) {
    return { superflex: null, teamCount: null, ppr: null, draftRounds: null, label: null };
  }

  const [sleeper, drafts] = await Promise.all([
    getLeague(leagueId).catch(() => null),
    getLeagueDrafts(leagueId).catch(() => []),
  ]);

  const positions = sleeper?.roster_positions || [];
  const qbSlots = positions.filter((slot) => slot === 'QB').length;
  const superflex = sleeper ? positions.includes('SUPER_FLEX') || qbSlots > 1 : null;
  const teamCount = sleeper ? positiveInt(sleeper.total_rosters) : null;
  const pprRaw = sleeper?.scoring_settings?.rec;
  const ppr = pprRaw == null ? null : Number(pprRaw);
  const newestDraft = drafts[0];
  const draftRounds = positiveInt(newestDraft?.settings?.rounds);

  const pieces = ['Dynasty'];
  if (superflex != null) pieces.push(superflex ? 'Superflex' : '1QB');
  if (teamCount != null) pieces.push(`${teamCount}-Team`);
  const scoring = scoringLabel(ppr);
  if (scoring) pieces.push(scoring);

  return {
    superflex,
    teamCount,
    ppr: Number.isFinite(ppr) ? ppr : null,
    draftRounds,
    label: pieces.length > 1 ? pieces.join(' · ') : null,
  };
}
