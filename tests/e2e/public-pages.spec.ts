/**
 * Core product, auth-boundary, and responsive smoke tests.
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

test.describe('Public product pages', () => {
  test('homepage shows LeagueZone HQ branding', async ({ page }) => {
    await page.goto(BASE_URL + '/');
    await expect(page.getByText('LeagueZone HQ', { exact: false }).first()).toBeVisible();
  });

  test('/features page loads with product metadata', async ({ page }) => {
    await page.goto(BASE_URL + '/features');
    await expect(page).toHaveTitle(/leaguezone/i);
  });

  test('/login page shows a usable account form without horizontal overflow', async ({ page }) => {
    await page.goto(BASE_URL + '/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  });

  test('/register page shows registration form', async ({ page }) => {
    await page.goto(BASE_URL + '/register');
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('invalid invite code shows a not-found state', async ({ page }) => {
    await page.goto(BASE_URL + '/join/INVALIDCODE999');
    const body = await page.content();
    expect(body.toLowerCase()).toMatch(/not found|404|invalid/);
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
    const body = await response.json();
    expect(body).toMatchObject({ error: 'Unauthorized' });
  });
});

test.describe('League-specific pages', () => {
  test('/l/east-v-west resolves without an application error URL', async ({ page }) => {
    await page.goto(BASE_URL + '/l/east-v-west');
    expect(page.url()).not.toContain('/error');
  });
});
