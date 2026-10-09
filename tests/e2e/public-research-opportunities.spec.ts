import { test, expect } from '@playwright/test';

test('Radar separates role change from scoring and retains filters across seasons', async ({ page }) => {
  const apiCalls: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/')) apiCalls.push(request.url()); });
  await page.goto('/research');
  await expect(page.locator('.tool-discovery a[href="/research/radar"]')).toBeVisible();
  await page.locator('.tool-discovery a[href="/research/radar"]').click();
  await expect(page.locator('#tool-panel .tool-card').first()).toBeVisible();
  await expect(page.locator('#tool-panel')).toContainText('fantasy points/game');
  await page.locator('[data-role="falling"]').click();
  await expect(page.locator('#tool-panel .role-label.rising')).toHaveCount(0);
  await page.locator('#tool-year').selectOption('2025');
  await expect(page.locator('#data-stamp')).toContainText('2025');
  await expect(page.locator('#tool-panel .tool-card').first()).toBeVisible();
  expect(apiCalls).toEqual([]);
});

test('Receipts keeps forward observations separate from reconstructed history', async ({ page }) => {
  await page.goto('/research/radar?season=2026');
  await expect(page.locator('#tool-panel .tool-card').first()).toBeVisible();
  await page.goto('/research/receipts?season=2026');
  await expect(page.locator('.forward-receipts')).toContainText('Forward record on this device');
  await expect(page.locator('.forward-receipts .receipt-row').first()).toBeVisible();
  await expect(page.locator('.forward-receipts .receipt-row').first()).toContainText('Saved');
  await page.locator('#tool-year').selectOption('2025');
  await expect(page.locator('.receipt-list').last().locator('.receipt-row').first()).toBeVisible();
  await expect(page.locator('#tool-panel')).toContainText('Historical replay');
});

test('Development Lab shows multiple seasons and same-stage comparisons without false projection', async ({ page }) => {
  await page.goto('/research/development?season=2025');
  await expect(page.locator('#lab-search')).toBeVisible();
  await page.locator('#lab-search').fill('Christian McCaffrey');
  await page.locator('#lab-results button').first().click();
  await expect(page.locator('#lab-detail')).toContainText('2023');
  await expect(page.locator('#lab-detail')).toContainText('2025');
  await expect(page.locator('#lab-detail')).toContainText('Same-stage comparisons');
});

test('research tools remain within mobile viewport', async ({ page, isMobile }) => {
  test.skip(!isMobile);
  for (const route of ['radar','receipts','development']) {
    await page.goto('/research/'+route+'?season=2025');
    await expect(page.locator('#tool-panel')).toBeVisible();
    const overflows=await page.evaluate(() => document.documentElement.scrollWidth>window.innerWidth+1);
    expect(overflows, route+' has horizontal overflow').toBe(false);
  }
});
