import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('Yahoo activation safety', () => {
  it('uses the canonical production callback in documented environment configuration', () => {
    const env = source('ENV_EXAMPLE.txt');
    const callback = 'https://leaguezonehq.com/api/providers/yahoo/callback';
    expect(env).toContain(`YAHOO_REDIRECT_URI=${callback}`);
  });

  it('clears short-lived OAuth cookies on terminal callback outcomes', () => {
    const callback = source('src/app/api/providers/yahoo/callback/route.ts');
    expect(callback).toContain('redirectAndClearOAuth');
    expect(callback).toContain("response.cookies.set('lz_yahoo_oauth_state', '', { path: '/', maxAge: 0 })");
    expect(callback).toContain("response.cookies.set('lz_yahoo_oauth_league', '', { path: '/', maxAge: 0 })");
    expect(callback).toContain('state !== expectedState');
  });

  it('scopes Yahoo disconnect to the authenticated provider account only', () => {
    const accounts = source('src/lib/server/provider-accounts.ts');
    const status = source('src/app/api/providers/yahoo/status/route.ts');
    expect(accounts).toContain('disconnectYahooProviderAccount(userId: string)');
    expect(accounts).toContain('WHERE user_id = ${userId}::uuid');
    expect(accounts).toContain('AND provider = ${YAHOO_PROVIDER}');
    expect(status).toContain('export async function DELETE()');
    expect(status).toContain('disconnectYahooProviderAccount(session.userId)');
  });

  it('does not overwrite a different provider mapping during Yahoo re-import', () => {
    const setup = source('src/app/api/setup/yahoo/route.ts');
    expect(setup).toContain('already linked to another provider season');
    expect(setup).toContain("WHERE league_provider_seasons.provider = 'yahoo'");
    expect(setup).toContain('league_provider_seasons.provider_league_id = EXCLUDED.provider_league_id');
    expect(setup).toContain('skippedSeasons');
    expect(setup).not.toContain("provider = 'yahoo', provider_league_id = EXCLUDED.provider_league_id");
  });
});
