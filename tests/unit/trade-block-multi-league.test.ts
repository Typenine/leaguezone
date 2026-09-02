import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  loadTradeBlockLeagueContext,
  sanitizeTradeBlock,
  teamAssetsFromContext,
  TradeBlockProviderError,
  type TradeBlockProviderDeps,
} from '@/lib/server/trade-block-provider';
import type { TradeBlockLeague, TradeBlockTeam } from '@/lib/server/trade-block-store';

function league(id: string, sleeperLeagueId: string | null): TradeBlockLeague {
  return { id, slug: `league-${id}`, name: `League ${id}`, sleeperLeagueId };
}

const teams: TradeBlockTeam[] = [
  { team: 'Alpha', rosterId: 1, userId: '11111111-1111-1111-1111-111111111111' },
  { team: 'Beta', rosterId: 2, userId: '22222222-2222-2222-2222-222222222222' },
];

function providerDeps(seen: string[] = []): TradeBlockProviderDeps {
  return {
    getLeague: vi.fn(async (leagueId: string) => {
      seen.push(`league:${leagueId}`);
      return { season: '2026', settings: { draft_rounds: 3, waiver_budget: 100 } } as never;
    }),
    getLeagueRosters: vi.fn(async (leagueId: string) => {
      seen.push(`rosters:${leagueId}`);
      return [
        { roster_id: 1, players: ['p1', 'p2'], settings: { waiver_budget_used: 20 } },
        { roster_id: 2, players: ['p3'], settings: { waiver_budget_used: 0 } },
      ] as never;
    }),
    fetchImpl: vi.fn(async (input: RequestInfo | URL) => {
      seen.push(`fetch:${String(input)}`);
      return new Response(JSON.stringify([]), { status: 200 });
    }),
  };
}

describe('league-scoped trade block provider', () => {
  it('keeps two LeagueZone leagues on their own Sleeper IDs', async () => {
    const seen: string[] = [];
    const deps = providerDeps(seen);
    await loadTradeBlockLeagueContext(league('a', 'sleeper-a'), teams, deps);
    await loadTradeBlockLeagueContext(league('b', 'sleeper-b'), teams, deps);
    expect(seen).toContain('league:sleeper-a');
    expect(seen).toContain('rosters:sleeper-a');
    expect(seen).toContain('league:sleeper-b');
    expect(seen).toContain('rosters:sleeper-b');
    expect(seen.some((entry) => entry.includes('/league/sleeper-a/traded_picks'))).toBe(true);
    expect(seen.some((entry) => entry.includes('/league/sleeper-b/traded_picks'))).toBe(true);
  });

  it('never contacts Sleeper when the LeagueZone league has no Sleeper ID', async () => {
    const deps = providerDeps();
    await expect(loadTradeBlockLeagueContext(league('a', null), teams, deps)).rejects.toMatchObject({
      code: 'provider_not_configured', status: 409,
    });
    expect(deps.getLeague).not.toHaveBeenCalled();
    expect(deps.getLeagueRosters).not.toHaveBeenCalled();
    expect(deps.fetchImpl).not.toHaveBeenCalled();
  });

  it('returns a provider error instead of substituting another league', async () => {
    const deps = providerDeps();
    deps.getLeague = vi.fn(async () => { throw new Error('Sleeper down'); });
    await expect(loadTradeBlockLeagueContext(league('a', 'sleeper-a'), teams, deps)).rejects.toBeInstanceOf(TradeBlockProviderError);
    expect(deps.fetchImpl).not.toHaveBeenCalled();
  });

  it('builds and validates a valid league trade-block response from that league roster', async () => {
    const ctx = await loadTradeBlockLeagueContext(league('a', 'sleeper-a'), teams, providerDeps());
    const assets = teamAssetsFromContext('Alpha', 1, ctx);
    expect(assets.players).toEqual(['p1', 'p2']);
    expect(assets.faab).toBe(80);
    expect(sanitizeTradeBlock([
      { type: 'player', playerId: 'p1' },
      { type: 'player', playerId: 'p3' },
      { type: 'faab', amount: 90 },
    ], assets)).toEqual([
      { type: 'player', playerId: 'p1' },
      { type: 'faab', amount: 80 },
    ]);
  });
});

describe('trade-block authorization and storage isolation', () => {
  it('denies an authenticated user after the active-league cookie is changed to another league', async () => {
    vi.resetModules();
    vi.doMock('@/lib/server/session', () => ({
      requireUser: vi.fn(async () => ({ userId: '11111111-1111-1111-1111-111111111111' })),
    }));
    vi.doMock('@/lib/server/user-auth', () => ({ getUserLeagues: vi.fn(async () => []) }));
    vi.doMock('@/server/db/client', () => ({
      getDb: () => ({ execute: vi.fn(async () => ({ rows: [] })) }),
    }));
    const headers = await import('next/headers');
    vi.mocked(headers.cookies).mockResolvedValue({
      get: vi.fn((name: string) => name === 'active_league_id'
        ? { value: '22222222-2222-2222-2222-222222222222' }
        : undefined),
      set: vi.fn(),
      delete: vi.fn(),
    } as never);

    const { getActiveLeagueMembership } = await import('@/lib/server/membership');
    const result = await getActiveLeagueMembership();
    expect(result).toEqual({ ok: false, status: 403, error: 'Not a member of this league' });
  });

  it('does not let mutation routes choose a league from request parameters or bodies', () => {
    const meRoute = fs.readFileSync(path.join(process.cwd(), 'src/app/api/me/trade-block/route.ts'), 'utf8');
    const legacyRoute = fs.readFileSync(path.join(process.cwd(), 'src/app/api/trade-block/route.ts'), 'utf8');
    expect(meRoute).toContain('requireActiveLeagueMembership()');
    expect(legacyRoute).toContain('requireActiveLeagueMembership()');
    expect(meRoute).not.toContain("searchParams.get('leagueId')");
    expect(meRoute).not.toContain('body.leagueId');
    expect(legacyRoute).not.toContain("searchParams.get('leagueId')");
    expect(legacyRoute).not.toContain('body.leagueId');
  });

  it('uses composite league/user storage rather than the legacy user-only primary key', () => {
    const migration = fs.readFileSync(path.join(process.cwd(), 'drizzle/0025_trade_block_league_scope.sql'), 'utf8');
    expect(migration).toContain('PRIMARY KEY (league_id, user_id)');
    expect(migration).toContain('HAVING COUNT(DISTINCT li.league_id) = 1');
  });
});
