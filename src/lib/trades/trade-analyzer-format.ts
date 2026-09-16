import { getFantasyLeagueSettings } from '@/lib/server/provider-settings';

type LeagueForTradeAnalyzer = {
  id?: string | null;
};

export type TradeAnalyzerLeagueFormat = {
  superflex: boolean | null;
  teamCount: number | null;
  ppr: number | null;
  draftRounds: number | null;
  label: string | null;
};

function scoringLabel(ppr: number | null): string | null {
  if (ppr == null || !Number.isFinite(ppr)) return null;
  if (ppr === 0) return 'Standard';
  if (ppr === 0.5) return 'Half-PPR';
  if (ppr === 1) return 'PPR';
  return `${ppr} PPR`;
}

/** Resolve the analyzer format from LeagueZone's provider-neutral league settings. */
export async function resolveTradeAnalyzerLeagueFormat(
  league: LeagueForTradeAnalyzer | null | undefined,
): Promise<TradeAnalyzerLeagueFormat> {
  const leagueId = league?.id?.trim() || '';
  if (!leagueId) return { superflex: null, teamCount: null, ppr: null, draftRounds: null, label: null };

  const settings = await getFantasyLeagueSettings(leagueId).catch(() => null);
  if (!settings) return { superflex: null, teamCount: null, ppr: null, draftRounds: null, label: null };

  const pieces = ['Dynasty'];
  if (settings.superflex != null) pieces.push(settings.superflex ? 'Superflex' : '1QB');
  if (settings.teamCount != null) pieces.push(`${settings.teamCount}-Team`);
  const scoring = scoringLabel(settings.ppr);
  if (scoring) pieces.push(scoring);

  return {
    superflex: settings.superflex,
    teamCount: settings.teamCount,
    ppr: settings.ppr,
    draftRounds: settings.draftRounds,
    label: pieces.length > 1 ? pieces.join(' · ') : null,
  };
}
