import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeCompletedSetupSteps } from '@/lib/setup/steps';

function source(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('LeagueZone setup productization', () => {
  it('normalizes legacy setup progress without preserving the retired admin step', () => {
    expect(normalizeCompletedSetupSteps(['league', 'sleeper', 'admin', 'branding', 'sleeper'])).toEqual([
      'league',
      'provider',
      'branding',
    ]);
  });

  it('prevents the retired setup-admin endpoint from creating users or platform admins', () => {
    const route = source('src/app/api/setup/admin/route.ts');
    expect(route).toContain('LEGACY_ADMIN_SETUP_RETIRED');
    expect(route).toContain('status: 410');
    expect(route).not.toContain('INSERT INTO users');
    expect(route).not.toContain('password_hash');
    expect(route).not.toContain("'admin'");
  });

  it('uses one provider setup step for both Sleeper and Yahoo imports', () => {
    const sleeper = source('src/app/api/setup/sleeper/route.ts');
    const yahoo = source('src/app/api/setup/yahoo/route.ts');
    expect(sleeper).toContain("? 'provider'");
    expect(sleeper).toContain('["provider"]');
    expect(yahoo).toContain("? 'provider'");
    expect(yahoo).toContain('["provider"]');
  });

  it('prevents Sleeper imports from overwriting Yahoo or different Sleeper season mappings', () => {
    const sleeper = source('src/app/api/setup/sleeper/route.ts');
    expect(sleeper).toContain('already linked to another provider season');
    expect(sleeper).toContain("WHERE league_provider_seasons.provider = 'sleeper'");
    expect(sleeper).toContain('league_provider_seasons.provider_league_id = EXCLUDED.provider_league_id');
    expect(sleeper).toContain('skippedSeasons');
    expect(sleeper).not.toContain("provider = 'sleeper',");
  });

  it('keeps provider detection provider-neutral in platform administration', () => {
    const operations = source('src/app/admin/operations/page.tsx');
    const leagues = source('src/app/api/admin/leagues/route.ts');
    expect(operations).toContain('league_provider_seasons');
    expect(operations).toContain('no fantasy provider connected');
    expect(leagues).toContain('league_provider_seasons');
  });

  it('searches hosted leagues through provider-season mappings instead of Sleeper-only IDs', () => {
    const search = source('src/app/api/league/search/route.ts');
    expect(search).toContain("searchParams.get('providerLeagueId')");
    expect(search).toContain('league_provider_seasons');
    expect(search).toContain('matched_provider');
    expect(search).toContain('guardPublicDataRequest');
  });

  it('starts a true new-league flow and presents the provider chooser', () => {
    const dashboard = source('src/app/app/page.tsx');
    const grid = source('src/components/dashboard/MyLeaguesGrid.tsx');
    const setup = source('src/app/setup/page.tsx');
    const provider = source('src/app/setup/provider/page.tsx');

    expect(dashboard).toContain('href="/setup?new=1"');
    expect(grid).toContain('href="/setup?new=1"');
    expect(setup).toContain("id: 'provider'");
    expect(setup).not.toContain("id: 'admin'");
    expect(provider).toContain('Connect Sleeper');
    expect(provider).toContain('Connect Yahoo');
  });
});
