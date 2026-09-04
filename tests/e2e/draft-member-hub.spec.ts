import { expect, test } from '@playwright/test';

test.describe('LeagueZone member draft hub', () => {
  test('uses configured draft metadata, saved order and archived LeagueZone history without mobile overflow', async ({ page }) => {
    await page.route('**/api/auth/me**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ authenticated: true, isAdmin: true }),
      });
    });

    await page.route('**/api/draft/summary**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          league: { id: 'league-1', slug: 'test-league', name: 'Test League' },
          lifecycle: { state: 'open', date: '2027-05-15T18:00:00.000Z', location: 'League clubhouse' },
          draft: {
            id: 'draft-1',
            year: 2027,
            rounds: 2,
            clockSeconds: 90,
            status: 'NOT_STARTED',
            eventName: '2027 Startup Draft',
            playerPoolType: 'all_players',
            playerPoolLabel: 'All players',
            draftOrderType: 'snake',
            draftOrderLabel: 'Snake',
            slots: [
              { overall: 1, round: 1, team: 'Alpha' },
              { overall: 2, round: 1, team: 'Bravo' },
              { overall: 3, round: 2, team: 'Bravo' },
              { overall: 4, round: 2, team: 'Alpha' },
            ],
          },
        }),
      });
    });

    await page.route('**/api/draft/suggest**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ suggestions: [] }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ suggestions: [] }) });
      }
    });

    await page.route('**/api/draft/history**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          years: ['2026'],
          drafts: {
            '2026': {
              rounds: 1,
              picks_per_round: 2,
              team_hauls: [
                { team: 'Alpha', picks: [{ round: 1, pick: 1, player: 'Archived Runner', playerId: 'p1' }] },
                { team: 'Bravo', picks: [{ round: 1, pick: 2, player: 'GB Defense', playerId: 'GB' }] },
              ],
              linear_picks: [
                { pick_no: 1, round: 1, pick: 1, team: 'Alpha', player: 'Archived Runner', playerId: 'p1', pos: 'RB' },
                { pick_no: 2, round: 1, pick: 2, team: 'Bravo', player: 'GB Defense', playerId: 'GB', pos: 'DEF' },
              ],
            },
          },
        }),
      });
    });

    await page.goto('/draft?view=next');
    await expect(page.getByRole('heading', { name: '2027 Startup Draft', exact: true })).toBeVisible();
    await expect(page.getByText('All players', { exact: true })).toBeVisible();
    await expect(page.getByText('Snake', { exact: true })).toBeVisible();
    await expect(page.getByText('Rookie Draft')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Enter Draft Room' })).toHaveAttribute('href', '/draft/room');
    await expect(page.getByRole('link', { name: 'Commissioner Console' })).toHaveAttribute('href', '/l/test-league/admin/draft');
    await expect(page.getByText('Round 2')).toBeVisible();

    await page.getByRole('link', { name: 'Previous Drafts' }).click();
    await expect(page.getByText('Archived Runner')).toBeVisible();
    await expect(page.getByText('GB Defense')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Imported Sleeper History' })).toBeVisible();

    const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 2);
  });
});
