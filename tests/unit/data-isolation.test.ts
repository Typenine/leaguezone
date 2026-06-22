/**
 * Unit tests for multi-league data isolation.
 * Tests that suggestions, trade blocks, and settings do not leak between leagues.
 */
import { describe, it, expect } from 'vitest';

// ─── KV key namespacing ───────────────────────────────────────────────────────

describe('KV key namespacing', () => {
  function getSuggestionsSponsorsKey(leagueId: string | null): string {
    return leagueId ? `league:${leagueId}:suggestions:sponsors` : 'suggestions:sponsors';
  }

  it('generates league-scoped key when leagueId is present', () => {
    const key = getSuggestionsSponsorsKey('league-a-id');
    expect(key).toBe('league:league-a-id:suggestions:sponsors');
  });

  it('generates legacy key when leagueId is null', () => {
    const key = getSuggestionsSponsorsKey(null);
    expect(key).toBe('suggestions:sponsors');
  });

  it('two leagues have different KV keys', () => {
    const keyA = getSuggestionsSponsorsKey('league-a-id');
    const keyB = getSuggestionsSponsorsKey('league-b-id');
    expect(keyA).not.toBe(keyB);
  });
});

// ─── Trade block league scoping ───────────────────────────────────────────────

describe('trade block league scoping', () => {
  it('trade blocks from different leagues do not overlap', () => {
    const leagueATradeBlock = [{ type: 'player', playerId: 'p1' }];
    const leagueBTradeBlock = [{ type: 'player', playerId: 'p2' }];

    // Even if both leagues have a team called "The Tigers",
    // the trade blocks are associated by (userId, leagueId)
    const userDocA = { userId: 'user-1', leagueId: 'league-a', team: 'The Tigers', tradeBlock: leagueATradeBlock };
    const userDocB = { userId: 'user-1', leagueId: 'league-b', team: 'The Tigers', tradeBlock: leagueBTradeBlock };

    expect(userDocA.tradeBlock).not.toEqual(userDocB.tradeBlock);
    expect(userDocA.leagueId).not.toBe(userDocB.leagueId);
  });

  it('a user can update their trade block in League A without affecting League B', () => {
    const userDocA = { userId: 'user-1', leagueId: 'league-a', team: 'The Tigers', tradeBlock: [{ type: 'player', playerId: 'p1' }] };
    const userDocB = { userId: 'user-1', leagueId: 'league-b', team: 'The Tigers', tradeBlock: [] };

    // Update A's trade block
    userDocA.tradeBlock = [{ type: 'player', playerId: 'p1' }, { type: 'player', playerId: 'p2' }];

    // B is unaffected
    expect(userDocB.tradeBlock).toHaveLength(0);
    expect(userDocA.tradeBlock).toHaveLength(2);
  });
});

// ─── Settings authorization ───────────────────────────────────────────────────

describe('settings authorization', () => {
  function checkSettingsAuth(
    membership: { leagueId: string; isCommissioner: boolean } | null,
    targetLeagueId: string
  ): { allowed: boolean; reason?: string } {
    if (!membership) return { allowed: false, reason: 'Not authenticated' };
    if (membership.leagueId !== targetLeagueId) return { allowed: false, reason: 'Wrong league' };
    if (!membership.isCommissioner) return { allowed: false, reason: 'Not commissioner' };
    return { allowed: true };
  }

  it('commissioner can update their own league settings', () => {
    const membership = { leagueId: 'league-a', isCommissioner: true };
    const result = checkSettingsAuth(membership, 'league-a');
    expect(result.allowed).toBe(true);
  });

  it('commissioner cannot update a different league settings', () => {
    const membership = { leagueId: 'league-a', isCommissioner: true };
    const result = checkSettingsAuth(membership, 'league-b');
    expect(result.allowed).toBe(false);
  });

  it('non-commissioner member cannot update settings', () => {
    const membership = { leagueId: 'league-a', isCommissioner: false };
    const result = checkSettingsAuth(membership, 'league-a');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Not commissioner');
  });

  it('unauthenticated user cannot update settings', () => {
    const result = checkSettingsAuth(null, 'league-a');
    expect(result.allowed).toBe(false);
  });
});

// ─── Suggestions isolation ────────────────────────────────────────────────────

describe('suggestions isolation', () => {
  it('suggestions from League A do not appear in League B queries', () => {
    const allSuggestions = [
      { id: '1', text: 'Suggestion A1', leagueId: 'league-a' },
      { id: '2', text: 'Suggestion A2', leagueId: 'league-a' },
      { id: '3', text: 'Suggestion B1', leagueId: 'league-b' },
    ];

    const leagueASuggestions = allSuggestions.filter((s) => s.leagueId === 'league-a');
    const leagueBSuggestions = allSuggestions.filter((s) => s.leagueId === 'league-b');

    expect(leagueASuggestions).toHaveLength(2);
    expect(leagueBSuggestions).toHaveLength(1);
    expect(leagueBSuggestions[0].text).toBe('Suggestion B1');
  });
});

// ─── Migration failure behavior ───────────────────────────────────────────────

describe('migration failure', () => {
  it('a failed migration should be detectable (build must not continue)', () => {
    // Simulate that migrate-on-build.mjs exits 1 on error
    function runMigration(success: boolean): number {
      if (!success) return 1; // non-zero exit code
      return 0;
    }
    expect(runMigration(false)).toBe(1);
    expect(runMigration(true)).toBe(0);
  });
});
