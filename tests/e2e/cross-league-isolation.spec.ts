/**
 * Cross-league / cross-user data isolation.
 *
 * Registers two independent users, each creating their own league, and
 * proves that:
 *  - User A's "My Leagues" list never contains User B's league (and vice versa).
 *  - User A cannot use a tampered `active_league_id` cookie to read/update
 *    User B's league settings.
 *
 * Uses the Playwright `request` API directly (no browser UI) so the test is
 * fast and only exercises the server-side authorization boundary — the
 * thing that actually has to hold, regardless of what the UI shows/hides.
 */
import { test, expect, request as playwrightRequest } from '@playwright/test';
import { deleteTestUserAndLeagues } from './helpers/db';

test.describe('Cross-league data isolation', () => {
  test.skip(!process.env.DATABASE_URL, 'DATABASE_URL not configured for this test run');

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userA = { email: `isolation-a-${runId}@example.test`, password: 'CorrectHorseBattery9' };
  const userB = { email: `isolation-b-${runId}@example.test`, password: 'CorrectHorseBattery9' };

  test.afterAll(async () => {
    await Promise.all([
      deleteTestUserAndLeagues(userA.email).catch(() => {}),
      deleteTestUserAndLeagues(userB.email).catch(() => {}),
    ]);
  });

  test('two commissioners never see or mutate each other\'s league', async ({ baseURL }) => {
    const ctxA = await playwrightRequest.newContext({ baseURL, storageState: undefined });
    const ctxB = await playwrightRequest.newContext({ baseURL, storageState: undefined });

    // Register both accounts.
    const regA = await ctxA.post('/api/auth/register', {
      data: { email: userA.email, displayName: 'User A', password: userA.password, confirmPassword: userA.password },
    });
    expect(regA.ok()).toBeTruthy();

    const regB = await ctxB.post('/api/auth/register', {
      data: { email: userB.email, displayName: 'User B', password: userB.password, confirmPassword: userB.password },
    });
    expect(regB.ok()).toBeTruthy();

    // Each creates their own league.
    const leagueA = await ctxA.post('/api/setup/league', {
      data: { name: `Isolation League A ${runId}`, slug: `isolation-league-a-${runId}` },
    });
    expect(leagueA.ok()).toBeTruthy();
    const { leagueId: leagueIdA } = await leagueA.json();

    const leagueB = await ctxB.post('/api/setup/league', {
      data: { name: `Isolation League B ${runId}`, slug: `isolation-league-b-${runId}` },
    });
    expect(leagueB.ok()).toBeTruthy();
    const { leagueId: leagueIdB } = await leagueB.json();

    expect(leagueIdA).not.toBe(leagueIdB);

    // Neither user's league list should ever mention the other's league id.
    const meA = await (await ctxA.get('/api/auth/me')).json();
    const meB = await (await ctxB.get('/api/auth/me')).json();
    const leagueIdsForA = (meA.leagues || []).map((l: { leagueId: string }) => l.leagueId);
    const leagueIdsForB = (meB.leagues || []).map((l: { leagueId: string }) => l.leagueId);
    expect(leagueIdsForA).not.toContain(leagueIdB);
    expect(leagueIdsForB).not.toContain(leagueIdA);

    // User A tampers with their active_league_id cookie to point at League B,
    // then tries to update League B's setup-wizard branding. Must be denied
    // even though League B has no commissioner conflict check bypassable via
    // the cookie alone.
    const crossWrite = await ctxA.post('/api/setup/branding', {
      headers: { Cookie: `active_league_id=${leagueIdB}` },
      data: { primaryColor: '#ff0000', secondaryColor: '#000000', leagueId: leagueIdB },
    });
    expect([401, 403]).toContain(crossWrite.status());

    // And User A cannot read League B's commissioner/settings info as if it
    // were their own active league.
    const crossRead = await ctxA.get('/api/settings/commissioner', {
      headers: { Cookie: `active_league_id=${leagueIdB}` },
    });
    expect([401, 403]).toContain(crossRead.status());

    await ctxA.dispose();
    await ctxB.dispose();
  });
});
