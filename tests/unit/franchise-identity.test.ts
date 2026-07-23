import { afterEach, describe, expect, it, vi } from 'vitest';
import { CANONICAL_TEAM_BY_USER_ID } from '@/lib/constants/team-mapping';
import { resolveCanonicalTeamName } from '@/lib/utils/team-utils';

const originalWindow = globalThis.window;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalWindow) vi.stubGlobal('window', originalWindow);
});

describe('league-scoped franchise identity', () => {
  it('uses the active league owner mapping instead of a historical Sleeper name', () => {
    vi.stubGlobal('window', {
      __LEAGUE_CONFIG__: {
        currentLeagueId: 'current-league',
        currentSeason: '2026',
        previousLeagueIds: { '2025': 'previous-league' },
        franchiseNamesByOwnerId: {
          owner_1: 'Current Franchise Name',
        },
      },
    });

    expect(resolveCanonicalTeamName({
      ownerId: 'owner_1',
      rosterTeamName: 'Old Team Name',
      userDisplayName: 'Old Team Name',
    })).toBe('Current Franchise Name');
  });

  it('exposes runtime mappings to existing Object.entries consumers', () => {
    vi.stubGlobal('window', {
      __LEAGUE_CONFIG__: {
        currentLeagueId: 'current-league',
        currentSeason: '2026',
        previousLeagueIds: {},
        franchiseNamesByOwnerId: {
          owner_2: 'Renamed Franchise',
        },
      },
    });

    expect(Object.fromEntries(Object.entries(CANONICAL_TEAM_BY_USER_ID))).toMatchObject({
      owner_2: 'Renamed Franchise',
    });
  });

  it('keeps the normal Sleeper fallback for leagues without a franchise map', () => {
    vi.stubGlobal('window', {
      __LEAGUE_CONFIG__: {
        currentLeagueId: 'current-league',
        currentSeason: '2026',
        previousLeagueIds: {},
        franchiseNamesByOwnerId: {},
      },
    });

    expect(resolveCanonicalTeamName({
      ownerId: 'owner_3',
      rosterTeamName: 'My New League Team',
    })).toBe('My New League Team');
  });
});
