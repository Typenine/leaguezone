import { test, expect } from '@playwright/test';

test.describe('public research historical seasons without database', () => {
  test('loads historical leaderboards and changes scoring locally', async ({ page }) => {
    const apiCalls: string[] = [];
    page.on('request', req => {
      if (new URL(req.url()).pathname.startsWith('/api/')) apiCalls.push(req.url());
    });
    await page.goto('/research/stats?season=2025');
    await expect(page.locator('#data-stamp')).toContainText('2025 Season');
    await expect(page.locator('#result-count')).toContainText('players');
    await expect(page.locator('#players-body')).toContainText('Christian McCaffrey');
    await page.locator('#year').selectOption('2023');
    await expect(page.locator('#data-stamp')).toContainText('2023 Season');
    await expect(page.locator('#players-body')).toContainText('CeeDee Lamb');
    await page.locator('#scoring').selectOption('ppr');
    await expect(page.locator('#data-stamp')).toContainText('2023 Season');
    expect(apiCalls).toEqual([]);
  });

  test('historical profile deep-link opens a game log and permits comparisons', async ({ page }) => {
    await page.goto('/research/players/00-0031381?season=2025');
    await expect(page.locator('#data-stamp')).toContainText('2025 Season');
    await expect(page.locator('#profile')).toContainText('2025 game log');
    await expect(page.locator('#profile')).toContainText('Davante Adams');
    await page.locator('[data-add-profile]').click();
    await expect(page.locator('#compare-panel')).toBeVisible();
  });

  test('all historical snapshots can be served without authentication', async ({ request }) => {
    for (const year of [2023, 2024, 2025, 2026]) {
      const response = await request.get('/research/data/' + year + '.json');
      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body.year).toBe(year);
      expect(body.players.length).toBeGreaterThan(100);
    }
  });
});
