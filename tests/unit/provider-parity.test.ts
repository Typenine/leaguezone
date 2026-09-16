import { describe, expect, it } from 'vitest';
import { getProviderCapabilities, providerFeatureMessage } from '@/lib/providers/capabilities';
import { findLinkedYahooLeagueHistory } from '@/lib/providers/yahoo-history';
import { parseYahooDraftResultsXml } from '@/lib/providers/yahoo-draft';
import { parseYahooLeagueSettingsXml } from '@/lib/providers/yahoo-settings';
import { parseYahooWeeklyRosterXml } from '@/lib/providers/yahoo-weekly';
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
  it('enables LeagueZone-owned Yahoo features while keeping unavailable provider feeds explicit', () => {
    const yahoo = getProviderCapabilities('yahoo');
    expect(yahoo.standings).toBe(true);
    expect(yahoo.teamDetail).toBe(true);
    expect(yahoo.matchupPlayerScoring).toBe(true);
    expect(yahoo.health).toBe(true);
    expect(yahoo.projections).toBe(true);
    expect(yahoo.tradedDraftPicks).toBe(false);
    expect(yahoo.playoffBrackets).toBe(false);
    expect(providerFeatureMessage('yahoo', 'tradedDraftPicks')).toContain('not currently available');
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

describe('Yahoo league settings', () => {
  it('normalizes roster slots and scoring modifiers for LeagueZone tools', () => {
    const xml = `<fantasy_content><league><settings>
      <max_teams>12</max_teams><num_playoff_teams>7</num_playoff_teams><playoff_start_week>15</playoff_start_week>
      <uses_faab>1</uses_faab><waiver_budget>100</waiver_budget><can_trade_draft_picks>1</can_trade_draft_picks>
      <roster_positions>
        <roster_position><position>QB</position><count>1</count></roster_position>
        <roster_position><position>W/R/T</position><count>2</count></roster_position>
        <roster_position><position>Q/W/R/T</position><count>1</count></roster_position>
        <roster_position><position>BN</position><count>5</count></roster_position>
      </roster_positions>
      <stat_categories><stats>
        <stat><stat_id>1</stat_id><name>Passing Yards</name></stat>
        <stat><stat_id>2</stat_id><name>Receptions</name></stat>
      </stats></stat_categories>
      <stat_modifiers><stats>
        <stat><stat_id>1</stat_id><value>0.04</value></stat>
        <stat><stat_id>2</stat_id><value>0.5</value></stat>
      </stats></stat_modifiers>
    </settings></league></fantasy_content>`;
    const settings = parseYahooLeagueSettingsXml(xml);
    expect(settings.teamCount).toBe(12);
    expect(settings.playoffTeams).toBe(7);
    expect(settings.playoffStartWeek).toBe(15);
    expect(settings.superflex).toBe(true);
    expect(settings.ppr).toBe(0.5);
    expect(settings.scoringSettings.pass_yd).toBe(0.04);
    expect(settings.usesFaab).toBe(true);
    expect(settings.waiverBudget).toBe(100);
  });
});

describe('Yahoo weekly roster scoring', () => {
  it('preserves lineup slots and actual weekly player points', () => {
    const xml = `<fantasy_content><team><team_key>475.l.77.t.1</team_key><roster><players>
      <player><player_key>475.p.100</player_key><name><full>Quarter Back</full></name><display_position>QB</display_position><editorial_team_abbr>GB</editorial_team_abbr><selected_position><position>QB</position></selected_position><player_points><total>22.4</total></player_points></player>
      <player><player_key>475.p.200</player_key><name><full>Bench Back</full></name><display_position>RB</display_position><editorial_team_abbr>CHI</editorial_team_abbr><selected_position><position>BN</position></selected_position><player_points><total>8.1</total></player_points></player>
    </players></roster></team></fantasy_content>`;
    const row = parseYahooWeeklyRosterXml(xml, '475.l.77.t.1');
    expect(row.starters).toEqual(['475.p.100']);
    expect(row.playerPoints['475.p.100']).toBe(22.4);
    expect(row.playerPoints['475.p.200']).toBe(8.1);
    expect(row.players.find((player) => player.playerId === '475.p.200')?.isStarter).toBe(false);
  });
});
