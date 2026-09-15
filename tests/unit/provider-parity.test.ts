import { describe, expect, it } from 'vitest';
import { getProviderCapabilities, providerFeatureMessage } from '@/lib/providers/capabilities';
import { findLinkedYahooLeagueHistory } from '@/lib/providers/yahoo-history';
import { parseYahooDraftResultsXml } from '@/lib/providers/yahoo-draft';
import type { ProviderLeagueSummary } from '@/lib/providers/types';

function league(input: Partial<ProviderLeagueSummary> & Pick<ProviderLeagueSummary, 'providerLeagueId' | 'season'>): ProviderLeagueSummary {
  return {
    provider: 'yahoo',
    providerLeagueId: input.providerLeagueId,
    providerGameId: input.providerGameId ?? input.providerLeagueId.split('.')[0],
    name: input.name ?? 'Dynasty League',
    season: input.season,
    numTeams: input.numTeams ?? 12,
    logoUrl: input.logoUrl ?? null,
    isFinished: input.isFinished ?? false,
    metadata: input.metadata ?? {},
  };
}

describe('provider capabilities', () => {
  it('keeps unsupported Yahoo detail features explicit', () => {
    const yahoo = getProviderCapabilities('yahoo');
    expect(yahoo.standings).toBe(true);
    expect(yahoo.teamDetail).toBe(true);
    expect(yahoo.matchupPlayerScoring).toBe(false);
    expect(yahoo.health).toBe(false);
    expect(yahoo.tradedDraftPicks).toBe(false);
    expect(providerFeatureMessage('yahoo', 'health')).toContain('not currently available');
  });
});

describe('Yahoo historical league discovery', () => {
  it('walks only explicit renew links and ignores a same-name unrelated league', () => {
    const y2024 = league({ providerLeagueId: '449.l.77', providerGameId: '449', season: 2024, metadata: { leagueId: '77', renewed: '461_77' } });
    const y2025 = league({ providerLeagueId: '461.l.77', providerGameId: '461', season: 2025, metadata: { leagueId: '77', renew: '449_77', renewed: '475_77' } });
    const y2026 = league({ providerLeagueId: '475.l.77', providerGameId: '475', season: 2026, metadata: { leagueId: '77', renew: '461_77' } });
    const unrelated = league({ providerLeagueId: '475.l.99', providerGameId: '475', season: 2026, name: 'Dynasty League', metadata: { leagueId: '99' } });
    expect(findLinkedYahooLeagueHistory(y2026, [unrelated, y2024, y2025, y2026]).map((row) => row.season)).toEqual([2026, 2025, 2024]);
  });
});

describe('Yahoo draft results', () => {
  it('normalizes draft results without inventing unavailable names', () => {
    const xml = `<fantasy_content><league><draft_results>
      <draft_result><pick>2</pick><round>1</round><team_key>475.l.77.t.2</team_key><player_key>475.p.200</player_key></draft_result>
      <draft_result><pick>1</pick><round>1</round><team_key>475.l.77.t.1</team_key><player_key>475.p.100</player_key></draft_result>
    </draft_results></league></fantasy_content>`;
    expect(parseYahooDraftResultsXml(xml)).toEqual([
      { pick: 1, round: 1, providerTeamId: '475.l.77.t.1', providerPlayerId: '475.p.100', teamName: null, playerName: null },
      { pick: 2, round: 1, providerTeamId: '475.l.77.t.2', providerPlayerId: '475.p.200', teamName: null, playerName: null },
    ]);
  });
});
