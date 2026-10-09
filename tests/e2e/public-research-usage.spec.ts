import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

type P = { id: string; n: string; pos: string; g: number; ryr: number | null; w: unknown[][] };
type U = { throughWeek: number; teams: Record<string, number[][]>; players: Record<string, (number | string)[][]> };
const season = (y: number) => JSON.parse(readFileSync(`public/research/data/${y}.json`, 'utf8')) as { throughWeek: number; players: P[] };
const usage = (y: number) => JSON.parse(readFileSync(`public/research/data/usage/${y}.json`, 'utf8')) as U;

// Independent of metrics.js: sum numerators and the week's own team denominators.
function share(u: U, id: string, num: number, den: number) {
  let a = 0, b = 0;
  for (const r of u.players[id] || []) {
    a += r[num] as number;
    b += u.teams[r[1] as string].find(t => t[0] === r[0])![den];
  }
  return b > 0 ? a / b : null;
}
const pct = (v: number) => (v * 100).toFixed(1) + '%';
const RESULT = '#players-body [data-profile]:visible, #mobile-results [data-profile]:visible';
const firstName = (page: Page) => page.locator(RESULT).first();
async function noOverflow(page: Page) {
  const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(sw).toBeLessThanOrEqual(cw + 1);
}

test.describe('advanced usage', () => {
  test('core research does not download advanced usage', async ({ page }) => {
    const usageCalls: string[] = [];
    page.on('request', r => { if (r.url().includes('/research/data/usage/')) usageCalls.push(r.url()); });
    await page.goto('/research?season=2025');
    await expect(firstName(page)).toBeVisible();
    await page.waitForTimeout(500);
    expect(usageCalls).toEqual([]);
  });

  test('WR target-share sort matches independent calculation', async ({ page }) => {
    const d = season(2025), u = usage(2025);
    const wrs = d.players.filter(p => p.pos === 'WR' && p.g >= 1)
      .map(p => ({ p, v: share(u, p.id, 6, 3) ?? -1 })).sort((a, b) => b.v - a.v || a.p.n.localeCompare(b.p.n));
    await page.goto('/research?season=2025&pos=WR&sort=tgtShare');
    await expect(page.locator('#view')).toHaveValue('usage');
    await expect(page.locator('#usage-status')).toContainText('Shares = player total');
    await expect(firstName(page)).toHaveAttribute('data-profile', wrs[0].p.id);
    await noOverflow(page);
    await page.screenshot({ path: test.info().outputPath('usage-wr-leaders.png') });
  });

  test('QB usage view sorts by attempts in every scoring format', async ({ page }) => {
    const d = season(2025), u = usage(2025);
    const att = (p: P) => (u.players[p.id] || []).reduce((s, r) => s + (r[2] as number), 0);
    const top = d.players.filter(p => p.pos === 'QB').sort((a, b) => att(b) - att(a))[0];
    for (const scoring of ['half', 'ppr', 'standard']) {
      await page.goto(`/research?season=2025&pos=QB&view=usage&sort=att&scoring=${scoring}`);
      await expect(firstName(page)).toHaveAttribute('data-profile', top.id);
    }
    if (await page.locator('#players-body').isVisible()) {
      await expect(page.locator('thead [data-sort-key="cmpPct"]')).toBeVisible();
      await expect(page.locator('thead [data-sort-key="ypa"]')).toBeVisible();
    }
  });

  test('rookie filter still applies in the usage view', async ({ page }) => {
    const rookies = new Set(season(2025).players.filter(p => p.ryr === 2025).map(p => p.id));
    await page.goto('/research?season=2025&pos=WR&view=usage&rookies=1');
    await expect(firstName(page)).toBeVisible();
    const names = await page.locator(RESULT).evaluateAll(els => els.map(e => e.getAttribute('data-profile') || ''));
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(rookies.has(n)).toBe(true);
  });

  test('WR profile shows opportunity values, trend and weekly chart', async ({ page }) => {
    const d = season(2025), u = usage(2025);
    const p = d.players.filter(x => x.pos === 'WR' && x.g >= 10).sort((a, b) => b.g - a.g)[0];
    await page.goto(`/research/players/${p.id}?season=2025`);
    const sec = page.locator('#usage-profile');
    await expect(sec.locator('.metric', { hasText: 'Target share' }).first().locator('.value')).toHaveText(pct(share(u, p.id, 6, 3)!));
    await expect(sec.locator('.metric', { hasText: 'Air-yards share' }).locator('.value')).toHaveText(pct(share(u, p.id, 8, 4)!));
    await expect(sec.locator('[data-usage-trend="tgtShare"]')).toBeVisible();
    await expect(sec.locator('.usage-chart rect')).toHaveCount(u.players[p.id].length);
    await expect(sec.locator('#usage-weekly tbody tr')).toHaveCount(p.w.length);
    await expect(page.locator('#profile-summary')).toContainText('Fantasy production');
    await noOverflow(page);
    const fits = await page.locator('.usage-trend').evaluate(t => t.scrollWidth <= (t.parentElement as HTMLElement).clientWidth);
    expect(fits).toBe(true);
    await sec.screenshot({ path: test.info().outputPath('usage-wr-profile.png') });
  });

  test('RB profile leads with carry share, QB with passing', async ({ page }) => {
    const d = season(2025), u = usage(2025);
    const rb = d.players.find(x => x.n === 'Christian McCaffrey')!;
    await page.goto(`/research/players/${rb.id}?season=2025`);
    await expect(page.locator('#usage-profile .metric', { hasText: 'Carry share' }).first().locator('.value')).toHaveText(pct(share(u, rb.id, 5, 2)!));
    await expect(page.locator('#usage-profile [data-usage-trend="carShare"]')).toBeVisible();
    const qb = d.players.filter(x => x.pos === 'QB' && x.g >= 10)[0];
    const rows = u.players[qb.id];
    const cmp = rows.reduce((s, r) => s + (r[3] as number), 0), att = rows.reduce((s, r) => s + (r[2] as number), 0);
    await page.goto(`/research/players/${qb.id}?season=2025`);
    await expect(page.locator('#usage-profile .metric', { hasText: 'Completion percentage' }).locator('.value')).toHaveText(pct(cmp / att));
    await noOverflow(page);
  });

  test('kicker and defense profiles have no usage section or request', async ({ page }) => {
    const d = season(2025);
    const usageCalls: string[] = [];
    page.on('request', r => { if (r.url().includes('/research/data/usage/')) usageCalls.push(r.url()); });
    for (const pos of ['K', 'DEF']) {
      const p = d.players.find(x => x.pos === pos)!;
      await page.goto(`/research/players/${p.id}?season=2025`);
      await expect(page.locator('#profile-summary')).toBeVisible();
      await expect(page.locator('#usage-profile')).toHaveCount(0);
    }
    expect(usageCalls).toEqual([]);
  });

  test('failed usage download leaves core stats working', async ({ page }) => {
    await page.route('**/research/data/usage/**', r => r.abort());
    await page.goto('/research?season=2025&pos=WR&view=usage');
    await expect(page.locator('#usage-status')).toContainText('failed to load');
    await expect(firstName(page)).toBeVisible();
    const p = season(2025).players.find(x => x.n === 'Christian McCaffrey')!;
    await page.goto(`/research/players/${p.id}?season=2025`);
    await expect(page.locator('#usage-state')).toContainText('Core statistics are unaffected');
    await expect(page.locator('#profile-summary .metric').first()).toBeVisible();
  });

  test('season missing from the usage manifest is reported as unavailable', async ({ page }) => {
    await page.route('**/research/data/usage/seasons.json', r => r.fulfill({ json: { schema: 1, years: [2025] } }));
    await page.goto('/research?season=2024&pos=RB&sort=carShare');
    await expect(page.locator('#usage-status')).toContainText('not available for 2024');
    await expect(firstName(page)).toBeVisible();
    await expect(page.locator('.missing:visible').first()).toBeVisible();
  });

  test('cross-season comparison shows usage rates with differences', async ({ page }) => {
    const p = season(2025).players.find(x => x.n === 'Christian McCaffrey')!;
    const u24 = usage(2024), u25 = usage(2025);
    test.skip(!u24.players[p.id], 'needs a 2024 season');
    await page.goto(`/research/players/${p.id}?season=2025`);
    await expect(page.locator('#career-history')).toContainText('2024');
    await page.locator('[data-add-profile][data-year="2025"]').first().click();
    await page.locator('#career-history [data-add-profile][data-year="2024"]').click();
    await expect(page.locator('#compare-grid .panel')).toHaveCount(2);
    const row = page.locator('#compare-detail .cmp-row[data-metric="carShare"]');
    await expect(row).toBeVisible();
    await expect(row).toContainText(pct(share(u25, p.id, 5, 2)!));
    await expect(row).toContainText(pct(share(u24, p.id, 5, 2)!));
    await expect(page.locator('#compare-detail')).toContainText('never season totals');
    await noOverflow(page);
  });
});
