/**
 * Unit tests for requireSetupLeagueOwnership — the helper that closed the
 * "any authenticated user can claim/edit an unclaimed league by guessing or
 * looking up its id via /api/league/search" gap in the setup wizard routes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('requireSetupLeagueOwnership', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns null when leagueId is missing', async () => {
    const { requireSetupLeagueOwnership } = await import('@/lib/server/setup-ownership');
    const result = await requireSetupLeagueOwnership('user-1', undefined);
    expect(result).toBeNull();
  });

  it('allows the existing commissioner without re-claiming', async () => {
    const execute = vi.fn().mockResolvedValueOnce({ rows: [{ id: 'league-a' }] });
    vi.doMock('@/server/db/client', () => ({ getDb: vi.fn(() => ({ execute })) }));

    const { requireSetupLeagueOwnership } = await import('@/lib/server/setup-ownership');
    const result = await requireSetupLeagueOwnership('commissioner-a', 'league-a');
    expect(result).toEqual({ leagueId: 'league-a' });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('claims an unclaimed, still-in-setup league for the requesting user', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] }) // not already owned
      .mockResolvedValueOnce({ rows: [{ id: 'league-b' }] }); // atomic claim succeeds
    vi.doMock('@/server/db/client', () => ({ getDb: vi.fn(() => ({ execute })) }));

    const { requireSetupLeagueOwnership } = await import('@/lib/server/setup-ownership');
    const result = await requireSetupLeagueOwnership('new-user', 'league-b');
    expect(result).toEqual({ leagueId: 'league-b' });
  });

  it('denies a user for a league already owned by someone else', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] }) // not owned by this user
      .mockResolvedValueOnce({ rows: [] }); // claim fails: commissioner_user_id not null
    vi.doMock('@/server/db/client', () => ({ getDb: vi.fn(() => ({ execute })) }));

    const { requireSetupLeagueOwnership } = await import('@/lib/server/setup-ownership');
    const result = await requireSetupLeagueOwnership('attacker', 'league-owned-by-someone-else');
    expect(result).toBeNull();
  });

  it('denies claiming a league that has already completed setup', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] }) // not owned by this user
      .mockResolvedValueOnce({ rows: [] }); // claim fails: setup_completed = true excludes it
    vi.doMock('@/server/db/client', () => ({ getDb: vi.fn(() => ({ execute })) }));

    const { requireSetupLeagueOwnership } = await import('@/lib/server/setup-ownership');
    const result = await requireSetupLeagueOwnership('attacker', 'live-league-id');
    expect(result).toBeNull();
  });

  it('a cross-league tampered id never resolves to another commissioner\'s league', async () => {
    // Commissioner A tries to pass League B's id (tampered request body).
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] }) // commissioner-a does not own league-b
      .mockResolvedValueOnce({ rows: [] }); // league-b already has commissioner-b, claim fails
    vi.doMock('@/server/db/client', () => ({ getDb: vi.fn(() => ({ execute })) }));

    const { requireSetupLeagueOwnership } = await import('@/lib/server/setup-ownership');
    const result = await requireSetupLeagueOwnership('commissioner-a', 'league-b');
    expect(result).toBeNull();
  });
});
