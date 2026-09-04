import { expect, test } from '@playwright/test';

type PostedBody = Record<string, unknown>;

const teams = [
  { rosterId: 1, teamName: 'Alpha', ownerName: 'Owner A' },
  { rosterId: 2, teamName: 'Bravo', ownerName: 'Owner B' },
  { rosterId: 3, teamName: 'Charlie', ownerName: 'Owner C' },
  { rosterId: 4, teamName: 'Delta', ownerName: 'Owner D' },
];

test.describe('commissioner draft setup', () => {
  test('configures a custom pool and per-round order with mobile-safe layout', async ({ page }, testInfo) => {
    let posted: PostedBody | null = null;

    await page.route('**/api/league-admin/drafts**', async (route) => {
      const request = route.request();
      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            league: { id: '11111111-1111-1111-1111-111111111111', slug: 'e2e-draft-league', name: 'Draft E2E League' },
            teams,
            drafts: [],
          }),
        });
        return;
      }
      posted = request.postDataJSON() as PostedBody;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, draftId: '22222222-2222-2222-2222-222222222222', pool: { count: 2, defenses: 1, rookies: 0 }, warning: null }),
      });
    });

    await page.goto('/__e2e/draft-setup');
    await expect(page.getByRole('heading', { name: 'Draft Setup' })).toBeVisible();

    const selects = page.locator('select');
    await selects.nth(0).selectOption('custom');
    await selects.nth(1).selectOption('custom');

    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'custom-draft.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('id,name,pos,nfl,rank\n12345,Future Runner,RB,GB,1\nGB,Green Bay,DEF,GB,2\n'),
    });
    await expect(page.getByText(/2 custom draftable players loaded/i)).toBeVisible();

    await page.getByRole('button', { name: 'Move Bravo up in round 1' }).click();
    await page.getByRole('button', { name: 'Create Draft' }).click();
    await expect.poll(() => posted).not.toBeNull();

    expect(posted?.playerPoolType).toBe('custom');
    expect(posted?.draftOrderType).toBe('custom');
    expect(Array.isArray(posted?.customPlayers)).toBeTruthy();
    expect((posted?.customPlayers as unknown[]).length).toBe(2);
    const roundOrders = posted?.roundOrders as Record<string, string[]>;
    expect(roundOrders['1']).toEqual(['Bravo', 'Alpha', 'Charlie', 'Delta']);

    if (testInfo.project.name === 'mobile-chrome') {
      const dimensions = await page.evaluate(() => ({
        viewport: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
      }));
      expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewport + 1);
      expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewport + 1);
      await expect(page.getByRole('button', { name: 'Create Draft' })).toBeVisible();
    }
  });

  test('shows every supported draft pool and order preset', async ({ page }) => {
    await page.route('**/api/league-admin/drafts**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ league: { id: '1', slug: 'e2e-draft-league', name: 'Draft E2E League' }, teams, drafts: [] }),
      });
    });
    await page.goto('/__e2e/draft-setup');
    const selects = page.locator('select');
    await expect(selects.nth(0).locator('option')).toHaveCount(5);
    await expect(selects.nth(1).locator('option')).toHaveCount(3);
    await expect(selects.nth(0)).toContainText('Veterans only');
    await expect(selects.nth(0)).toContainText('Custom player pool');
    await expect(selects.nth(1)).toContainText('Snake');
    await expect(selects.nth(1)).toContainText('Custom by round');
  });
});
