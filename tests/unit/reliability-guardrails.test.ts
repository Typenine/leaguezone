import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  beforeDatabaseRequest,
  getDatabaseCircuitState,
  recordDatabaseFailure,
  recordDatabaseSuccess,
  resetDatabaseCircuitForTests,
  DatabaseCircuitOpenError,
} from '@/lib/server/db-circuit-breaker';
import { reliabilityKey } from '@/lib/server/reliability-cache';

describe('LeagueZone reliability guardrails', () => {
  it('opens the database circuit after repeated infrastructure failures', () => {
    resetDatabaseCircuitForTests();
    recordDatabaseFailure(1_000);
    recordDatabaseFailure(2_000);
    expect(getDatabaseCircuitState(2_000).open).toBe(false);

    const state = recordDatabaseFailure(3_000);
    expect(state.opened).toBe(true);
    expect(() => beforeDatabaseRequest(3_001)).toThrow(DatabaseCircuitOpenError);

    beforeDatabaseRequest(state.openUntil + 1);
    expect(getDatabaseCircuitState(state.openUntil + 1).open).toBe(false);
    recordDatabaseSuccess();
  });

  it('builds bounded reliability-cache keys', () => {
    const key = reliabilityKey('fantasy', 'standings', 'ABC 123', 2026);
    expect(key).toBe('lz:reliability:v1:fantasy:standings:abc_123:2026');
  });

  it('keeps league metadata outside Postgres for read-only fallback', () => {
    const source = readFileSync(new URL('../../src/lib/server/league-context.ts', import.meta.url), 'utf8');
    expect(source).toContain("reliabilityKey('league', 'slug'");
    expect(source).toContain('LEAGUE_STALE_SECONDS');
    expect(source).toContain('_reliability');
  });

  it('uses a strict public-data budget with a local fallback if KV is unavailable', () => {
    const limiter = readFileSync(new URL('../../src/lib/server/rate-limit.ts', import.meta.url), 'utf8');
    const guard = readFileSync(new URL('../../src/lib/server/public-api-guard.ts', import.meta.url), 'utf8');
    expect(limiter).toContain('rateLimitByIpStrict');
    expect(limiter).toContain('strictLocalFallback');
    expect(guard).toContain('requireBrowserGate');
    expect(guard).toContain('429');
  });

  it('protects anonymous database-backed API surfaces before route execution', () => {
    const middleware = readFileSync(new URL('../../src/middleware.ts', import.meta.url), 'utf8');
    expect(middleware).toContain('PUBLIC_DATA_API_PREFIXES');
    expect(middleware).toContain("'/api/fantasy/'");
    expect(middleware).toContain("'/api/transactions'");
    expect(middleware).toContain('anonymousPublicDataRequest');
  });

  it('does not fall back to an arbitrary newest league', () => {
    const info = readFileSync(new URL('../../src/app/api/league/info/route.ts', import.meta.url), 'utf8');
    expect(info).toContain('getCurrentLeague');
    expect(info).not.toContain('ORDER BY created_at DESC');
  });

  it('surfaces stale data mode to the browser', () => {
    const client = readFileSync(new URL('../../src/lib/fantasy/client.ts', import.meta.url), 'utf8');
    const layout = readFileSync(new URL('../../src/app/l/[leagueSlug]/layout.tsx', import.meta.url), 'utf8');
    expect(client).toContain('leaguezone:data-stale');
    expect(layout).toContain('ReadOnlyFallbackBanner');
  });

  it('only opens the database circuit for infrastructure-classified failures', () => {
    const client = readFileSync(new URL('../../src/server/db/client.ts', import.meta.url), 'utf8');
    expect(client).toContain('isInfrastructureFailure');
    expect(client).toContain("'exceeded the quota'");
    expect(client).toContain("code.startsWith('08')");
  });
});
