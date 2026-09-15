import { afterEach, describe, expect, it } from 'vitest';
import { decryptProviderToken, encryptProviderToken } from '@/lib/providers/crypto';
import { buildYahooAuthorizationUrl, parseYahooLeaguesXml, parseYahooTeamsXml } from '@/lib/providers/yahoo';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('Yahoo provider parsing', () => {
  it('normalizes Yahoo leagues from XML', () => {
    const xml = `
      <fantasy_content>
        <users count="1">
          <user>
            <games count="1">
              <game>
                <game_key>461</game_key>
                <code>nfl</code>
                <season>2026</season>
                <leagues count="2">
                  <league>
                    <league_key>461.l.111</league_key>
                    <league_id>111</league_id>
                    <name>Long Running Dynasty</name>
                    <num_teams>12</num_teams>
                    <is_finished>0</is_finished>
                  </league>
                  <league>
                    <league_key>461.l.222</league_key>
                    <league_id>222</league_id>
                    <name>Work League</name>
                    <num_teams>10</num_teams>
                    <is_finished>1</is_finished>
                  </league>
                </leagues>
              </game>
            </games>
          </user>
        </users>
      </fantasy_content>`;

    const leagues = parseYahooLeaguesXml(xml);
    expect(leagues).toHaveLength(2);
    expect(leagues[0]).toMatchObject({
      provider: 'yahoo',
      providerLeagueId: '461.l.111',
      providerGameId: '461',
      name: 'Long Running Dynasty',
      season: 2026,
      numTeams: 12,
      isFinished: false,
    });
    expect(leagues[1].isFinished).toBe(true);
  });

  it('normalizes Yahoo teams and identifies the authenticated commissioner', () => {
    const xml = `
      <fantasy_content>
        <league>
          <league_key>461.l.111</league_key>
          <teams count="2">
            <team>
              <team_key>461.l.111.t.1</team_key>
              <team_id>1</team_id>
              <name>Badgers</name>
              <team_logos><team_logo><size>large</size><url>https://example.com/badgers.png</url></team_logo></team_logos>
              <managers><manager><manager_id>1</manager_id><nickname>Mason</nickname><is_commissioner>1</is_commissioner><is_current_login>1</is_current_login></manager></managers>
            </team>
            <team>
              <team_key>461.l.111.t.2</team_key>
              <team_id>2</team_id>
              <name>Raptors</name>
              <managers><manager><manager_id>2</manager_id><nickname>Alex</nickname></manager></managers>
            </team>
          </teams>
        </league>
      </fantasy_content>`;

    const teams = parseYahooTeamsXml(xml);
    expect(teams).toHaveLength(2);
    expect(teams[0]).toEqual({
      providerTeamId: '461.l.111.t.1',
      rosterId: 1,
      teamName: 'Badgers',
      ownerName: 'Mason',
      logoUrl: 'https://example.com/badgers.png',
      isCurrentUser: true,
      isCommissioner: true,
    });
    expect(teams[1]).toMatchObject({
      rosterId: 2,
      teamName: 'Raptors',
      ownerName: 'Alex',
      isCurrentUser: false,
      isCommissioner: false,
    });
  });
});

describe('Yahoo OAuth and token protection', () => {
  it('encrypts provider tokens without storing the plaintext value', () => {
    process.env.PROVIDER_TOKEN_ENCRYPTION_KEY = 'test-only-provider-token-encryption-key-123456';
    const encrypted = encryptProviderToken('very-secret-refresh-token');
    expect(encrypted).not.toContain('very-secret-refresh-token');
    expect(decryptProviderToken(encrypted)).toBe('very-secret-refresh-token');
  });

  it('builds the Yahoo authorization-code URL with CSRF state', () => {
    process.env.PROVIDER_TOKEN_ENCRYPTION_KEY = 'test-only-provider-token-encryption-key-123456';
    process.env.YAHOO_CLIENT_ID = 'client-id';
    process.env.YAHOO_CLIENT_SECRET = 'client-secret';
    process.env.YAHOO_REDIRECT_URI = 'https://leaguezonehq.vercel.app/api/providers/yahoo/callback';

    const url = new URL(buildYahooAuthorizationUrl('state-value'));
    expect(url.origin + url.pathname).toBe('https://api.login.yahoo.com/oauth2/request_auth');
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe('state-value');
    expect(url.searchParams.get('redirect_uri')).toBe('https://leaguezonehq.vercel.app/api/providers/yahoo/callback');
  });
});
