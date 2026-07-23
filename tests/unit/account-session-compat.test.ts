import { beforeEach, describe, expect, it, vi } from 'vitest';

function mockCookies(values: Record<string, string | undefined>) {
  vi.doMock('next/headers', () => ({
    cookies: vi.fn().mockResolvedValue({
      get: vi.fn((name: string) => {
        const value = values[name];
        return value ? { value } : undefined;
      }),
      set: vi.fn(),
      delete: vi.fn(),
    }),
  }));
}

describe('account session compatibility', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('resolves an email account to its team in the active league', async () => {
    mockCookies({ evw_session: 'signed-token', active_league_id: 'league-1' });
    vi.doMock('@/lib/server/auth', () => ({
      verifySession: vi.fn(() => ({ type: 'user', sub: '11111111-1111-1111-1111-111111111111' })),
    }));
    vi.doMock('@/lib/server/user-identity', () => ({
      getUserIdForTeam: vi.fn((team: string) => `legacy:${team}`),
    }));
    vi.doMock('@/server/db/client', () => ({
      getDb: vi.fn(() => ({
        execute: vi.fn().mockResolvedValue({ rows: [{ team_name: 'The Tigers' }] }),
      })),
    }));

    const { requireTeamUser } = await import('@/lib/server/session');
    await expect(requireTeamUser()).resolves.toEqual({
      team: 'The Tigers',
      userId: '11111111-1111-1111-1111-111111111111',
    });
  });

  it('uses a single league membership when the active-league cookie is missing', async () => {
    mockCookies({ evw_session: 'signed-token' });
    vi.doMock('@/lib/server/auth', () => ({
      verifySession: vi.fn(() => ({ type: 'user', sub: '11111111-1111-1111-1111-111111111111' })),
    }));
    vi.doMock('@/lib/server/user-identity', () => ({
      getUserIdForTeam: vi.fn((team: string) => `legacy:${team}`),
    }));
    vi.doMock('@/server/db/client', () => ({
      getDb: vi.fn(() => ({
        execute: vi.fn().mockResolvedValue({ rows: [{ team_name: 'The Tigers' }] }),
      })),
    }));

    const { requireTeamUser } = await import('@/lib/server/session');
    await expect(requireTeamUser()).resolves.toMatchObject({ team: 'The Tigers' });
  });

  it('does not guess a team when an account has multiple leagues and no active selection', async () => {
    mockCookies({ evw_session: 'signed-token' });
    vi.doMock('@/lib/server/auth', () => ({
      verifySession: vi.fn(() => ({ type: 'user', sub: '11111111-1111-1111-1111-111111111111' })),
    }));
    vi.doMock('@/lib/server/user-identity', () => ({
      getUserIdForTeam: vi.fn((team: string) => `legacy:${team}`),
    }));
    vi.doMock('@/server/db/client', () => ({
      getDb: vi.fn(() => ({
        execute: vi.fn().mockResolvedValue({
          rows: [{ team_name: 'The Tigers' }, { team_name: 'The Bears' }],
        }),
      })),
    }));

    const { requireTeamUser } = await import('@/lib/server/session');
    await expect(requireTeamUser()).resolves.toBeNull();
  });

  it('keeps legacy team sessions working', async () => {
    mockCookies({ evw_session: 'legacy-token' });
    vi.doMock('@/lib/server/auth', () => ({
      verifySession: vi.fn(() => ({ team: 'Legacy Team', sub: 'Legacy Team' })),
    }));
    vi.doMock('@/lib/server/user-identity', () => ({
      getUserIdForTeam: vi.fn((team: string) => `legacy:${team}`),
    }));
    vi.doMock('@/server/db/client', () => ({
      getDb: vi.fn(() => ({ execute: vi.fn() })),
    }));

    const { requireTeamUser } = await import('@/lib/server/session');
    await expect(requireTeamUser()).resolves.toEqual({
      team: 'Legacy Team',
      userId: 'legacy:Legacy Team',
    });
  });
});
