/**
 * Core product, auth-boundary, navigation, and responsive smoke tests.
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

test.describe('Public product pages', () => {
  test('homepage shows LeagueZone HQ branding', async ({ page }) => {
    await page.goto(BASE_URL + '/');
    await expect(page.getByText('LeagueZone HQ', { exact: false }).first()).toBeVisible();
    // Should NOT show East v. West specific branding on the product homepage
    // (It may appear in a "demo league" section, but not as the primary identity)
  });

  test('homepage calls to action navigate instead of being masked by setup state', async ({ page }) => {
    await page.goto(BASE_URL + '/');
    await page.getByRole('link', { name: 'Launch Your League' }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('/features page loads with product metadata', async ({ page }) => {
    await page.goto(BASE_URL + '/features');
    await expect(page).toHaveTitle(/leaguezone/i);
  });

  test('/login page shows a usable account form without horizontal overflow', async ({ page }) => {
    await page.goto(BASE_URL + '/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  });

  test('/register page shows registration form', async ({ page }) => {
    await page.goto(BASE_URL + '/register');
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('invalid invite code shows a not-found state', async ({ page }) => {
    await page.goto(BASE_URL + '/join/INVALIDCODE999');
    // Should show 404 or "not found" page
    // Either redirected to 404 or content shows not found
    const body = await page.content();
    expect(body.toLowerCase()).toMatch(/not found|404|invalid/);
  });

  test('newsletter is dormant by default', async ({ page, request }) => {
    await page.goto(BASE_URL + '/newsletter');
    await expect(page.getByText('Newsletter is dormant', { exact: true })).toBeVisible();
    const response = await request.get(BASE_URL + '/api/newsletter/episodes', { maxRedirects: 0 });
    expect(response.status()).toBe(410);
    expect(await response.json()).toMatchObject({ error: 'Newsletter feature is currently dormant.' });
  });
});

test.describe('Authentication boundaries', () => {
  test('protected browser pages preserve the requested destination', async ({ page }) => {
    await page.goto(BASE_URL + '/trade-block');
    const destination = new URL(page.url());
    expect(destination.pathname).toBe('/login');
    expect(destination.searchParams.get('next')).toBe('/trade-block');
  });

  test('protected APIs return JSON 401 instead of login HTML', async ({ request }) => {
    const response = await request.get(BASE_URL + '/api/trade-block', { maxRedirects: 0 });
    expect(response.status()).toBe(401);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(await response.json()).toMatchObject({ error: 'Unauthorized' });
  });
});

test.describe('League-specific navigation', () => {
  test.skip(!process.env.DATABASE_URL, 'DATABASE_URL not configured for league-data browser tests');

  test('league navigation stays under the canonical slug instead of redirecting to legacy routes', async ({ page }) => {
    await page.goto(BASE_URL + '/l/east-v-west');
    await page.getByRole('link', { name: 'Teams', exact: true }).click();
    await expect(page).toHaveURL(/\/l\/east-v-west\/teams(?:\?|$)/);
    await expect(page.getByRole('heading', { name: 'Teams', exact: true })).toBeVisible();
  });

  test('East v. West public metadata and standings summary are populated', async ({ page }) => {
    await page.goto(BASE_URL + '/l/east-v-west');
    await expect(page.getByText('Est. 2023', { exact: false })).toBeVisible();
    await expect(page.getByText('Current records, points, seeds, and season standings', { exact: true })).toBeVisible();
  });

  test('East v. West standings use its configured 2026 Sleeper season', async ({ page }) => {
    await page.goto(BASE_URL + '/l/east-v-west/standings');
    await expect(page.getByLabel('Season')).toHaveValue('2026');
    await expect(page.getByLabel('Season').locator('option')).toHaveText(['2026', '2025', '2024', '2023']);
  });

  test('CCL standings remain on 2025 until a 2026 Sleeper league is connected', async ({ page }) => {
    await page.goto(BASE_URL + '/l/the-ccl/standings');
    await expect(page.getByLabel('Season')).toHaveValue('2025');
    await expect(page.getByLabel('Season').locator('option')).toHaveText(['2025', '2024', '2023', '2022', '2021', '2020']);
  });

  test('commissioner navigation is hidden from signed-out visitors', async ({ page }) => {
    await page.goto(BASE_URL + '/l/east-v-west');
    await expect(page.getByRole('link', { name: 'Commissioner', exact: true })).toHaveCount(0);
  });

  test('mobile league utility navigation exposes LeagueZone Home', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto(BASE_URL + '/l/east-v-west');
    await expect(page.getByRole('link', { name: 'LeagueZone Home', exact: true })).toBeVisible();
  });
});
