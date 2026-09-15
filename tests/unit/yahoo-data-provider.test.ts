import { describe, expect, it } from 'vitest';
import {
  parseYahooRosterXml,
  parseYahooScoreboardXml,
  parseYahooStandingsXml,
  parseYahooTransactionsXml,
} from '@/lib/providers/yahoo-data';

describe('Yahoo normalized league data', () => {
  it('normalizes standings and streaks', () => {
    const xml = `<fantasy_content><league><standings><teams>
      <team><team_key>461.l.111.t.1</team_key><team_id>1</team_id><name>Badgers</name><managers><manager><manager_id>1</manager_id><nickname>Mason</nickname></manager></managers><team_standings><outcome_totals><wins>8</wins><losses>2</losses><ties>0</ties></outcome_totals><streak><type>win</type><value>4</value></streak><points_for>1200.25</points_for><points_against>1010.50</points_against></team_standings></team>
      <team><team_key>461.l.111.t.2</team_key><team_id>2</team_id><name>Raptors</name><managers><manager><manager_id>2</manager_id><nickname>Alex</nickname></manager></managers><team_standings><outcome_totals><wins>7</wins><losses>3</losses><ties>0</ties></outcome_totals><streak><type>loss</type><value>1</value></streak><points_for>1150.10</points_for><points_against>1099.00</points_against></team_standings></team>
    </teams></standings></league></fantasy_content>`;
    const data = parseYahooStandingsXml(xml);
    expect(data.teams[0]).toMatchObject({ teamName: 'Badgers', ownerId: '1', wins: 8, losses: 2, fpts: 1200.25, fptsAgainst: 1010.5 });
    expect(data.streaks[1]).toEqual({ type: 'W', length: 4 });
    expect(data.streaks[2]).toEqual({ type: 'L', length: 1 });
  });

  it('normalizes roster players and starter state', () => {
    const xml = `<fantasy_content><team><team_key>461.l.111.t.1</team_key><roster><players>
      <player><player_key>461.p.100</player_key><name><full>Josh Allen</full><first>Josh</first><last>Allen</last></name><editorial_team_abbr>Buf</editorial_team_abbr><display_position>QB</display_position><selected_position><position>QB</position></selected_position></player>
      <player><player_key>461.p.200</player_key><name><full>Bench Player</full><first>Bench</first><last>Player</last></name><editorial_team_abbr>Sea</editorial_team_abbr><display_position>WR</display_position><selected_position><position>BN</position></selected_position></player>
    </players></roster></team></fantasy_content>`;
    const roster = parseYahooRosterXml(xml, '461.l.111.t.1');
    expect(roster.rosterId).toBe(1);
    expect(roster.players[0]).toMatchObject({ fullName: 'Josh Allen', position: 'QB', nflTeam: 'Buf', isStarter: true });
    expect(roster.players[1].isStarter).toBe(false);
  });

  it('normalizes scoreboard matchups with stable LeagueZone ids', () => {
    const xml = `<fantasy_content><league><scoreboard><matchups>
      <matchup><teams><team><team_key>461.l.111.t.4</team_key><team_id>4</team_id><name>Four</name><team_points><total>100.50</total></team_points></team><team><team_key>461.l.111.t.2</team_key><team_id>2</team_id><name>Two</name><team_points><total>110.25</total></team_points></team></teams></matchup>
      <matchup><teams><team><team_key>461.l.111.t.1</team_key><team_id>1</team_id><name>One</name><team_points><total>99.00</total></team_points></team><team><team_key>461.l.111.t.3</team_key><team_id>3</team_id><name>Three</name><team_points><total>98.75</total></team_points></team></teams></matchup>
    </matchups></scoreboard></league></fantasy_content>`;
    const matchups = parseYahooScoreboardXml(xml, '2026', 3);
    expect(matchups).toHaveLength(2);
    expect(matchups[0].matchupId).toBe(1);
    expect(matchups[0].teams.map((team) => team.rosterId).sort()).toEqual([1, 3]);
    expect(matchups[1].teams[0].points).toBe(100.5);
  });

  it('normalizes completed waiver and trade transactions', () => {
    const xml = `<fantasy_content><league><transactions>
      <transaction><transaction_key>461.l.111.tr.2</transaction_key><type>add/drop</type><status>successful</status><timestamp>1780000000</timestamp><faab_bid>7</faab_bid><players>
        <player><player_key>461.p.10</player_key><name><full>Added Player</full></name><display_position>RB</display_position><editorial_team_abbr>GB</editorial_team_abbr><transaction_data><type>add</type><source_type>waivers</source_type><destination_team_key>461.l.111.t.1</destination_team_key><destination_team_name>Badgers</destination_team_name></transaction_data></player>
        <player><player_key>461.p.11</player_key><name><full>Dropped Player</full></name><display_position>WR</display_position><transaction_data><type>drop</type><source_team_key>461.l.111.t.1</source_team_key><source_team_name>Badgers</source_team_name></transaction_data></player>
      </players></transaction>
      <transaction><transaction_key>461.l.111.tr.3</transaction_key><type>trade</type><status>successful</status><timestamp>1780001000</timestamp><players>
        <player><player_key>461.p.12</player_key><name><full>Trade Player</full></name><display_position>QB</display_position><transaction_data><type>trade</type><source_team_key>461.l.111.t.1</source_team_key><source_team_name>Badgers</source_team_name><destination_team_key>461.l.111.t.2</destination_team_key><destination_team_name>Raptors</destination_team_name></transaction_data></player>
      </players></transaction>
    </transactions></league></fantasy_content>`;
    const transactions = parseYahooTransactionsXml(xml, '2026');
    expect(transactions).toHaveLength(2);
    const waiver = transactions.find((txn) => txn.id === '461.l.111.tr.2');
    expect(waiver).toMatchObject({ type: 'waiver', team: 'Badgers', rosterId: 1, faab: 7 });
    const trade = transactions.find((txn) => txn.id === '461.l.111.tr.3');
    expect(trade?.type).toBe('trade');
    expect(trade?.teamsInvolved.sort()).toEqual(['Badgers', 'Raptors']);
    expect(trade?.added[0].name).toContain('(to Raptors)');
  });
});
