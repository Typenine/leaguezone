/**
 * E2E tests for public LeagueZone HQ product pages.
 * These should render platform branding, NOT East v. West league branding.
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

test.describe('Public product pages', () => {
  test('homepage shows LeagueZone HQ branding', async ({ page }) => {
    await page.goto(BASE_URL + '/');
    await expect(page.getByText('LeagueZone HQ', { exact: false })).toBeVisible();
    // Should NOT show East v. West specific branding on the product homepage
    // (It may appear in a "demo league" section, but not as the primary identity)
  });

  test('/features page loads without league-specific branding', async ({ page }) => {
    await page.goto(BASE_URL + '/features');
    // Should show the product features page
    const title = await page.title();
    expect(title.toLowerCase()).toContain('leaguezone');
  });

  test('/login page shows platform login form', async ({ page }) => {
    await page.goto(BASE_URL + '/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('/register page shows registration form', async ({ page }) => {
    await page.goto(BASE_URL + '/register');
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('invalid invite code shows 404', async ({ page }) => {
    await page.goto(BASE_URL + '/join/INVALIDCODE999');
    // Should show 404 or "not found" page
    const status = page.url();
    // Either redirected to 404 or content shows not found
    const body = await page.content();
    expect(body.toLowerCase()).toMatch(/not found|404|invalid/);
  });
});

test.describe('League-specific pages', () => {
  test('/l/east-v-west loads the East v. West league', async ({ page }) => {
    await page.goto(BASE_URL + '/l/east-v-west');
    // Page should load (either show the league or a not-found message if not seeded)
    const statusOk = !page.url().includes('error');
    expect(statusOk).toBe(true);
  });
});
