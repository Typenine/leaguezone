/**
 * Clean-user onboarding journey.
 *
 * Simulates a brand new Reddit-style visitor with no existing cookies,
 * memberships, or East v. West knowledge: register -> verify email -> sign in
 * -> start league setup -> create a league -> confirm it can be resumed without
 * creating a duplicate / hitting a slug collision.
 *
 * This test writes to the real configured database, so it always cleans up
 * the user/league it creates, and it skips itself (rather than failing the
 * whole suite) when no DATABASE_URL is configured for the test run.
 */
import { test, expect } from '@playwright/test';
import { deleteTestUserAndLeagues, getEmailVerificationToken } from './helpers/db';

test.describe('Clean-user onboarding journey', () => {
  test.skip(!process.env.DATABASE_URL, 'DATABASE_URL not configured for this test run');

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `onboarding-e2e-${runId}@example.test`;
  const password = 'CorrectHorseBattery9';
  const leagueName = `Onboarding E2E League ${runId}`;

  test.afterAll(async () => {
    await deleteTestUserAndLeagues(email).catch(() => {});
  });

  test('register -> verify -> sign in -> create league -> resume without duplicating', async ({ page }) => {
    // 1. Public landing page, with zero prior cookies (fresh browser context per test).
    await page.goto('/');

    // 2. Register a brand new account. Registration must not authenticate the
    // user before ownership of the email address has been verified.
    await page.goto('/register');
    await page.locator('#email').fill(email);
    await page.locator('#displayName').fill('Onboarding Tester');
    await page.locator('#password').fill(password);
    await page.locator('#confirmPassword').fill(password);
    await page.getByRole('button', { name: /create account/i }).click();
    await page.waitForURL(/\/verify-email(?:\?|$)/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /check your inbox/i })).toBeVisible();

    const meBeforeVerification = await page.request.get('/api/auth/me');
    expect(meBeforeVerification.status()).toBe(401);

    // 3. Correct credentials still cannot create a session while verification
    // is outstanding.
    const blockedLogin = await page.request.post('/api/auth/login', {
      data: { email, password },
    });
    expect(blockedLogin.status()).toBe(403);
    expect(await blockedLogin.json()).toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });

    // 4. Resending is available without a session and produces a fresh token.
    const resend = await page.request.post('/api/auth/resend-verification', {
      data: { email },
    });
    expect(resend.ok()).toBeTruthy();

    const verificationToken = await getEmailVerificationToken(email);
    await page.goto(`/verify-email/${verificationToken}`);
    await page.waitForURL(/\/login\?[^#]*verified=1/, { timeout: 15_000 });
    await expect(page.getByText(/email verified\. sign in to continue/i)).toBeVisible();

    // 5. Verified credentials create a normal persistent account session.
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/app(?:\?|$)/, { timeout: 15_000 });

    const meAfterVerification = await page.request.get('/api/auth/me');
    expect(meAfterVerification.ok()).toBeTruthy();

    // Confirm the session persists across navigation instead of prompting for
    // another login while the user moves through LeagueZone.
    await page.goto('/app');
    await expect(page).not.toHaveURL(/\/login/);

    // 6. Start league creation from the dashboard.
    await page.getByRole('link', { name: /create league/i }).first().click();
    await page.waitForURL(/\/setup/);
    await page.getByRole('button', { name: /get started/i }).click();
    await page.waitForURL(/\/setup\/league/);

    // 7. Fill out and submit the League Identity step.
    await page.locator('#name').fill(leagueName);
    await page.getByRole('button', { name: /continue/i }).click();
    await page.waitForURL(/\/setup\/sleeper/, { timeout: 15_000 });

    // 8. Simulate an interruption. Re-visiting the league step must resume the
    // same league, never create a second one or collide with its own slug.
    await page.goto('/setup/league');
    await expect(page.locator('#name')).toHaveValue(leagueName, { timeout: 15_000 });

    await page.getByRole('button', { name: /continue/i }).click();
    await page.waitForURL(/\/setup\/sleeper/, { timeout: 15_000 });

    // 9. Log out cleanly, then log back in and land on the dashboard again.
    const logoutResponse = await page.request.post('/api/auth/logout');
    expect(logoutResponse.ok()).toBeTruthy();

    await page.goto('/login');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/(app|home)?$|\/app/, { timeout: 15_000 });
  });
});
