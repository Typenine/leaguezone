/**
 * Clean-user onboarding journey.
 *
 * Simulates a brand new Reddit-style visitor with no existing cookies,
 * memberships, or East v. West knowledge: register -> land on /app signed
 * in -> start league setup -> create a league -> confirm it can be resumed
 * without creating a duplicate / hitting a slug collision.
 *
 * This test writes to the real configured database, so it always cleans up
 * the user/league it creates, and it skips itself (rather than failing the
 * whole suite) when no DATABASE_URL is configured for the test run.
 */
import { test, expect } from '@playwright/test';
import { deleteTestUserAndLeagues } from './helpers/db';

test.describe('Clean-user onboarding journey', () => {
  test.skip(!process.env.DATABASE_URL, 'DATABASE_URL not configured for this test run');

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `onboarding-e2e-${runId}@example.test`;
  const password = 'CorrectHorseBattery9';
  const leagueName = `Onboarding E2E League ${runId}`;

  test.afterAll(async () => {
    await deleteTestUserAndLeagues(email).catch(() => {});
  });

  test('register -> signed-in dashboard -> create league -> resume without duplicating', async ({ page }) => {
    // 1. Public landing page, with zero prior cookies (fresh browser context per test).
    await page.goto('/');

    // 2. Register a brand new account.
    await page.goto('/register');
    await page.locator('#email').fill(email);
    await page.locator('#displayName').fill('Onboarding Tester');
    await page.locator('#password').fill(password);
    await page.locator('#confirmPassword').fill(password);
    await page.getByRole('button', { name: /create account/i }).click();

    // 3. New users with no invite land on /app, signed in, with a welcome banner.
    await page.waitForURL(/\/app/, { timeout: 15_000 });
    await expect(page.getByText(/welcome to/i)).toBeVisible();

    // Confirm the session actually persists across navigation (no re-login
    // prompt) — this is the "remain signed in while moving between pages"
    // requirement.
    await page.goto('/app');
    await expect(page).not.toHaveURL(/\/login/);

    // 4. Start league creation from the dashboard.
    await page.getByRole('link', { name: /create league/i }).first().click();
    await page.waitForURL(/\/setup/);
    await page.getByRole('button', { name: /get started/i }).click();
    await page.waitForURL(/\/setup\/league/);

    // 5. Fill out and submit the League Identity step.
    await page.locator('#name').fill(leagueName);
    await page.getByRole('button', { name: /continue/i }).click();
    await page.waitForURL(/\/setup\/sleeper/, { timeout: 15_000 });

    // 6. Simulate an interruption: leave setup entirely and come back later
    // (e.g. closed tab / new day). Re-visiting the league step must resume
    // the same league — never create a second one or hit a duplicate-slug
    // error, and it must be pre-filled with what was already entered.
    await page.goto('/setup/league');
    await expect(page.locator('#name')).toHaveValue(leagueName, { timeout: 15_000 });

    // Re-submitting the (unchanged) form must succeed — it updates the
    // existing league in place instead of colliding with its own slug.
    await page.getByRole('button', { name: /continue/i }).click();
    await page.waitForURL(/\/setup\/sleeper/, { timeout: 15_000 });

    // 7. Log out cleanly, then log back in and land on the dashboard again.
    const logoutResponse = await page.request.post('/api/auth/logout');
    expect(logoutResponse.ok()).toBeTruthy();

    await page.goto('/login');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/(app|home)?$|\/app/, { timeout: 15_000 });
  });
});
