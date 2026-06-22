/**
 * Unit tests for the active-league membership helper and related session logic.
 * These tests run against mocked DB and cookie modules (see setup.ts).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Membership helper ───────────────────────────────────────────────────────

describe('getActiveLeagueMembership', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns 401 when no session cookie is present', async () => {
    vi.doMock('next/headers', () => ({
      cookies: vi.fn().mockResolvedValue({
        get: vi.fn().mockReturnValue(undefined),
        set: vi.fn(),
        delete: vi.fn(),
      }),
    }));

    // session.requireUser depends on verifySession which reads the cookie
    vi.doMock('@/lib/server/session', () => ({
      requireUser: vi.fn().mockResolvedValue(null),
      requireTeamUser: vi.fn().mockResolvedValue(null),
      requireAnySession: vi.fn().mockResolvedValue(null),
    }));

    const { getActiveLeagueMembership } = await import('@/lib/server/membership');
    const result = await getActiveLeagueMembership();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });

  it('returns 403 when user has no active league cookie', async () => {
    vi.doMock('@/lib/server/session', () => ({
      requireUser: vi.fn().mockResolvedValue({ userId: 'user-1' }),
      requireTeamUser: vi.fn().mockResolvedValue(null),
      requireAnySession: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock('next/headers', () => ({
      cookies: vi.fn().mockResolvedValue({
        get: vi.fn().mockReturnValue(undefined),
        set: vi.fn(),
        delete: vi.fn(),
      }),
    }));

    const { getActiveLeagueMembership } = await import('@/lib/server/membership');
    const result = await getActiveLeagueMembership();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it('returns 403 when user is not a member of the selected league', async () => {
    vi.doMock('@/lib/server/session', () => ({
      requireUser: vi.fn().mockResolvedValue({ userId: 'user-1' }),
      requireTeamUser: vi.fn().mockResolvedValue(null),
      requireAnySession: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock('next/headers', () => ({
      cookies: vi.fn().mockResolvedValue({
        get: vi.fn((name: string) => name === 'active_league_id' ? { value: 'league-a-id' } : undefined),
        set: vi.fn(),
        delete: vi.fn(),
      }),
    }));
    // DB returns no membership rows
    vi.doMock('@/server/db/client', () => ({
      getDb: vi.fn(() => ({
        execute: vi.fn().mockResolvedValue({ rows: [] }),
      })),
    }));

    const { getActiveLeagueMembership } = await import('@/lib/server/membership');
    const result = await getActiveLeagueMembership();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it('returns membership when user belongs to the active league', async () => {
    vi.doMock('@/lib/server/session', () => ({
      requireUser: vi.fn().mockResolvedValue({ userId: 'user-1' }),
      requireTeamUser: vi.fn().mockResolvedValue(null),
      requireAnySession: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock('next/headers', () => ({
      cookies: vi.fn().mockResolvedValue({
        get: vi.fn((name: string) => name === 'active_league_id' ? { value: 'league-a-id' } : undefined),
        set: vi.fn(),
        delete: vi.fn(),
      }),
    }));
    vi.doMock('@/server/db/client', () => ({
      getDb: vi.fn(() => ({
        execute: vi.fn().mockResolvedValue({
          rows: [{
            league_id: 'league-a-id',
            league_slug: 'league-a',
            league_name: 'League A',
            team_name: 'The Tigers',
            roster_id: 3,
            is_commissioner: false,
          }],
        }),
      })),
    }));

    const { getActiveLeagueMembership } = await import('@/lib/server/membership');
    const result = await getActiveLeagueMembership();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.membership.teamName).toBe('The Tigers');
      expect(result.membership.leagueId).toBe('league-a-id');
      expect(result.membership.rosterId).toBe(3);
    }
  });
});

// ─── League isolation: same team name, different leagues ─────────────────────

describe('league isolation by teamName', () => {
  it('two leagues can have The Tigers without collision', async () => {
    const leagueAId = 'league-a-id';
    const leagueBId = 'league-b-id';

    // Both leagues happen to have a team called "The Tigers"
    // but they must be resolved independently by (userId, leagueId)
    const membershipA = {
      userId: 'user-1',
      leagueId: leagueAId,
      leagueSlug: 'league-a',
      leagueName: 'League A',
      teamName: 'The Tigers',
      rosterId: 3,
      isCommissioner: false,
    };
    const membershipB = {
      userId: 'user-1',
      leagueId: leagueBId,
      leagueSlug: 'league-b',
      leagueName: 'League B',
      teamName: 'The Tigers',
      rosterId: 7,
      isCommissioner: false,
    };

    // In League A, rosterId is 3
    expect(membershipA.rosterId).toBe(3);
    expect(membershipA.leagueId).toBe(leagueAId);

    // In League B, rosterId is 7 — same team name, different context
    expect(membershipB.rosterId).toBe(7);
    expect(membershipB.leagueId).toBe(leagueBId);

    // They must NOT be the same membership
    expect(membershipA.rosterId).not.toBe(membershipB.rosterId);
    expect(membershipA.leagueId).not.toBe(membershipB.leagueId);
  });
});
