import { test, expect } from './research-test';

test('Radar shows verified role context and filters without treating points as opportunity', async ({ page }) => {
  const apiCalls: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/') && !request.url().includes('/api/research-feed/')) apiCalls.push(request.url()); });
  // Historical season is intentionally used: an archived fixture is not stale.
  await page.goto('/research?season=2025');
  await expect(page.locator('.tool-discovery a[href="/research/radar"]')).toBeVisible();
  await page.locator('.tool-discovery a[href="/research/radar"]').click();
  // Tool links do not preserve the overview query: select the archived season
  // explicitly rather than presenting intentionally stale current data.
  await page.locator('#tool-year').selectOption('2025');
  await expect(page.locator('#tool-panel')).toContainText('signals through Week');
  await expect(page.locator('#tool-panel')).toContainText('observed usage');
  const cards = page.locator('#tool-panel .tool-card');
  if (await cards.count()) await expect(cards.first()).toContainText('Role evidence');
  else await expect(page.locator('#tool-panel')).toContainText('No players meet these filters');
  await page.locator('[data-role="falling"]').click();
  await expect(page.locator('[data-role="falling"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#tool-panel .role-label.rising')).toHaveCount(0);
  await page.locator('#tool-year').selectOption('2024');
  await expect(page.locator('#data-stamp')).toContainText('2024');
  await expect(page.locator('#tool-panel')).toContainText('signals through Week');
  expect(apiCalls).toEqual([]);
});

test('Receipts never presents browser-local observations as audited forward records', async ({ page }) => {
  await page.goto('/research/receipts?season=2026');
  await expect(page.locator('.forward-receipts')).toContainText('Published forward record');
  await expect(page.locator('#tool-panel')).toContainText('Historical replay');
  const deviceLedger = await page.evaluate(() => localStorage.getItem('lz_research_forward_receipts_v1'));
  expect(deviceLedger).toBeNull();
  await page.locator('#tool-year').selectOption('2025');
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
