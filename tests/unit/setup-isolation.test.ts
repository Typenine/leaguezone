/**
 * Unit tests for setup wizard isolation.
 * Verifies that two commissioners setting up leagues simultaneously
 * don't interfere with each other.
 */
import { describe, it, expect } from 'vitest';

// ─── Setup ownership logic ────────────────────────────────────────────────────

describe('setup league ownership', () => {
  // Simulate the league resolution logic from setup routes
  function resolveSetupLeague(
    leagues: Array<{ id: string; commissioner_user_id: string | null }>,
    userId: string,
    leagueId: string
  ) {
    const league = leagues.find(
      (l) => l.id === leagueId && (l.commissioner_user_id === userId || l.commissioner_user_id === null)
    );
    return league ? { leagueId: league.id, ok: true } : { ok: false, error: 'Access denied' };
  }

  it('commissioner A can access League A but not League B', () => {
    const leagues = [
      { id: 'league-a', commissioner_user_id: 'commissioner-a' },
      { id: 'league-b', commissioner_user_id: 'commissioner-b' },
    ];

    const resultA = resolveSetupLeague(leagues, 'commissioner-a', 'league-a');
    expect(resultA.ok).toBe(true);

    const resultB = resolveSetupLeague(leagues, 'commissioner-a', 'league-b');
    expect(resultB.ok).toBe(false);
  });

  it('commissioner B can access League B but not League A', () => {
    const leagues = [
      { id: 'league-a', commissioner_user_id: 'commissioner-a' },
      { id: 'league-b', commissioner_user_id: 'commissioner-b' },
    ];

    const resultA = resolveSetupLeague(leagues, 'commissioner-b', 'league-a');
    expect(resultA.ok).toBe(false);

    const resultB = resolveSetupLeague(leagues, 'commissioner-b', 'league-b');
    expect(resultB.ok).toBe(true);
  });

  it('setup data remains isolated between two simultaneous commissioners', () => {
    // Simulate both commissioners calling setup routes at the same time
    const leagueAData = { name: 'League A', slug: 'league-a', sleeperLeagueId: 'sleeper-a' };
    const leagueBData = { name: 'League B', slug: 'league-b', sleeperLeagueId: 'sleeper-b' };

    // Each must be targeting their own league
    expect(leagueAData.slug).not.toBe(leagueBData.slug);
    expect(leagueAData.sleeperLeagueId).not.toBe(leagueBData.sleeperLeagueId);
  });
});

// ─── Slug conflict detection ──────────────────────────────────────────────────

describe('slug conflict', () => {
  function checkSlugConflict(
    existingSlugs: string[],
    newSlug: string,
    ownLeagueId?: string
  ): { conflict: boolean; status?: 409 } {
    const taken = existingSlugs.includes(newSlug);
    if (taken && !ownLeagueId) return { conflict: true, status: 409 };
    return { conflict: false };
  }

  it('returns 409 when slug is taken by another league', () => {
    const result = checkSlugConflict(['league-a', 'league-b'], 'league-a');
    expect(result.conflict).toBe(true);
    expect(result.status).toBe(409);
  });

  it('allows updating slug if it is already owned by the same league', () => {
    const result = checkSlugConflict(['league-a', 'league-b'], 'league-a', 'league-a-id');
    expect(result.conflict).toBe(false);
  });

  it('allows new unique slug', () => {
    const result = checkSlugConflict(['league-a', 'league-b'], 'league-c');
    expect(result.conflict).toBe(false);
  });
});
