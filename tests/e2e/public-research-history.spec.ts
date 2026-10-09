import { test, expect } from '@playwright/test';

test.describe('LeagueZone research, static data only', () => {
  test('loads historical leaders, verifies scoring and never calls Neon APIs', async ({ page }) => {
    const privateCalls: string[] = [];
    page.on('request', req => {
      const pathname = new URL(req.url()).pathname;
      if (pathname.startsWith('/api/') || pathname.startsWith('/l/')) privateCalls.push(pathname);
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
    expect(privateCalls).toEqual([]);
  });

  test('weekly leaderboards change statistical columns by position', async ({ page }) => {
    await page.goto('/research/stats?season=2025');
    await expect(page.locator('#data-stamp')).toContainText('2025 Season');
    await page.locator('#position').selectOption('QB');
    await expect(page.locator('#players-head')).toContainText('Pass yds');
    await page.locator('#week').selectOption('4');
    await expect(page.locator('#directory-title')).toContainText('Week 4');
    await expect(page.locator('#result-count')).toContainText('weekly performances');
    await page.locator('#position').selectOption('K');
    await expect(page.locator('#players-head')).toContainText('FG made');
    await page.locator('#position').selectOption('DEF');
    await expect(page.locator('#players-head')).toContainText('Pts allowed');
    await page.locator('#week').selectOption('0');
    await expect(page.locator('#directory-title')).toContainText('Season');
  });

  test('verified rookie filter keeps true rookies, excludes veterans', async ({ page }) => {
    await page.goto('/research/players?season=2025');
    await expect(page.locator('#data-stamp')).toContainText('2025 Season');
    await page.locator('#rookies').check();
    await page.locator('#search').fill('Ashton Jeanty');
    await expect(page.locator('#players-body')).toContainText('Ashton Jeanty');
    await page.locator('#search').fill('Christian McCaffrey');
    await expect(page.locator('#players-body')).toContainText('No results');
  });

  test('career seasons, weekly chart and cross-season comparisons work', async ({ page }) => {
    await page.goto('/research/players/00-0031381?season=2025');
    await expect(page.locator('#data-stamp')).toContainText('2025 Season');
    await expect(page.locator('#profile')).toContainText('2025 game log');
    await expect(page.locator('#profile')).toContainText('Davante Adams');
    await expect(page.locator('.trend-chart svg')).toHaveAttribute('role','img');
    await expect(page.locator('#career-history')).toContainText('2024');
    await page.locator('[data-add-profile][data-year="2025"]').first().click();
    await expect(page.locator('#compare-panel')).toBeVisible();
    await page.locator('[data-add-profile][data-year="2024"]').click();
    await expect(page.locator('#compare-grid .panel')).toHaveCount(2);
    await expect(page.locator('#compare-grid')).toContainText('2024');
    await expect(page.locator('#compare-grid')).toContainText('2025');
    await page.locator('#clear-compare').click();
    await expect(page.locator('#compare-panel')).toBeHidden();
  });

  test('mobile results remain functional without squeezing columns', async ({ page, isMobile }) => {
    test.skip(!isMobile,'Mobile-specific rendering');
    await page.goto('/research/players?season=2025');
    await expect(page.locator('#data-stamp')).toContainText('2025 Season');
    await expect(page.locator('.mobile-result').first()).toBeVisible();
    await expect(page.locator('.research-table')).toBeHidden();
    await page.locator('#position').selectOption('RB');
    await page.locator('#rookies').check();
    await expect(page.locator('#mobile-results')).toContainText('Ashton Jeanty');
    await page.locator('.mobile-result').first().locator('[data-profile]').click();
    await expect(page.locator('#profile')).toBeVisible();
    await expect(page.locator('.trend-chart svg')).toBeVisible();
  });

  test('historical static files and season index are available without authentication', async ({ request }) => {
    const m=await request.get('/research/data/seasons.json');
    expect(m.ok()).toBeTruthy();
    const manifest=await m.json();
    expect(manifest.years).toEqual([2023,2024,2025,2026]);
    for(const year of manifest.years) {
      const response=await request.get('/research/data/'+year+'.json');
      expect(response.ok()).toBeTruthy();
      const body=await response.json();
      expect(body.year).toBe(year);
      expect(body.schema).toBe(3);
      expect(body.players.length).toBeGreaterThan(100);
    }
  });
});
