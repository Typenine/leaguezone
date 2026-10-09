import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

type P = { id: string; n: string; pos: string; g: number; w: unknown[][] };
type Z = { throughWeek: number; fields: { player: string[]; team: string[] }; teams: Record<string, number[][]>; players: Record<string, (number | string)[][]> };
const season = (y: number) => JSON.parse(readFileSync(`public/research/data/${y}.json`, 'utf8')) as { throughWeek: number; players: P[] };
const redzone = (y: number) => JSON.parse(readFileSync(`public/research/data/redzone/${y}.json`, 'utf8')) as Z;

// Independent of metrics.js: sum the raw player rows and the team rows of the weeks he has stats.
function total(z: Z, id: string, field: string) {
  const i = z.fields.player.indexOf(field);
  return (z.players[id] || []).reduce((s, r) => s + (r[i] as number), 0);
}
function teamTotal(z: Z, p: P, field: string) {
  const i = z.fields.team.indexOf(field);
  return p.w.reduce((s, w) => s + z.teams[w[1] as string].find(t => t[0] === w[0])![i], 0);
}
const pct = (v: number) => (v * 100).toFixed(1) + '%';
const RESULT = '#players-body [data-profile]:visible, #mobile-results [data-profile]:visible';
const firstName = (page: Page) => page.locator(RESULT).first();
const byName = (y: number, n: string) => season(y).players.find(p => p.n === n)!;
async function noOverflow(page: Page) {
  const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(sw).toBeLessThanOrEqual(cw + 1);
}
function track(page: Page) {
  const calls: string[] = [];
  page.on('request', r => { if (r.url().includes('/research/data/redzone/')) calls.push(r.url()); });
  return calls;
}

test.describe('red zone', () => {
  test('core and advanced-usage views do not download red-zone data', async ({ page }) => {
    const calls = track(page);
    await page.goto('/research?season=2025');
    await expect(firstName(page)).toBeVisible();
    await page.selectOption('#view', 'usage');
    await expect(page.locator('#usage-status')).toContainText('Shares = player total');
    await page.waitForTimeout(400);
    expect(calls).toEqual([]);
  });

  test('RB goal-line carry sort matches independent totals', async ({ page }) => {
    const d = season(2025), z = redzone(2025);
    const top = d.players.filter(p => p.pos === 'RB').sort((a, b) => total(z, b.id, 'i5Car') - total(z, a.id, 'i5Car') || a.n.localeCompare(b.n))[0];
    await page.goto('/research?season=2025&pos=RB&view=redzone&sort=i5Car');
    await expect(page.locator('#usage-status')).toContainText('snapped at or inside the opponent 20');
    await expect(firstName(page)).toHaveAttribute('data-profile', top.id);
    await noOverflow(page);
    await page.screenshot({ path: test.info().outputPath('redzone-rb-leaders.png') });
  });

  test('a red-zone sort switches to the Red zone view; views switch back and forth', async ({ page }) => {
    const d = season(2025), z = redzone(2025);
    const top = d.players.filter(p => p.pos === 'WR').sort((a, b) => total(z, b.id, 'rzTgt') - total(z, a.id, 'rzTgt') || a.n.localeCompare(b.n))[0];
    await page.goto('/research?season=2025&pos=WR&sort=rzTgt');
    await expect(page.locator('#view')).toHaveValue('redzone');
    await expect(firstName(page)).toHaveAttribute('data-profile', top.id);
    if (await page.locator('#players-body').isVisible()) await expect(page.locator('thead [data-sort-key="rzTgtShare"]')).toBeVisible();
    await page.selectOption('#view', 'goalline');
    await expect(page).toHaveURL(/view=goalline/);
    await page.selectOption('#sort', 'points');
    await page.selectOption('#view', 'core');
    await expect(page.locator('#usage-status')).toHaveText('');
    await page.selectOption('#view', 'usage');
    await expect(page.locator('#usage-status')).toContainText('Shares = player total');
    await expect(firstName(page)).toBeVisible();
  });

  test('goal-line conversion lists small samples after qualified players', async ({ page }) => {
    await page.goto('/research?season=2025&pos=RB&view=goalline&sort=i5TdRate');
    await expect(page.locator('#sort-context')).toContainText('Under 5 goal-line opportunities');
    const id = await firstName(page).getAttribute('data-profile');
    const z = redzone(2025);
    expect(total(z, id!, 'i5Car') + total(z, id!, 'i5Tgt')).toBeGreaterThanOrEqual(5);
  });

  test('RB profile: zone breakdown, shares, chart and weekly table', async ({ page }) => {
    const p = byName(2025, 'Christian McCaffrey'), z = redzone(2025);
    await page.goto(`/research/players/${p.id}?season=2025`);
    const sec = page.locator('#redzone-profile');
    await expect(sec.locator('h2')).toHaveText('Red-Zone and Goal-Line Usage');
    const i5 = sec.locator('#rz-zones tr[data-zone="i5"] td');
    await expect(i5.nth(1)).toHaveText(String(total(z, p.id, 'i5Car')));
    await expect(i5.nth(3)).toHaveText(String(total(z, p.id, 'i5Tgt')));
    await expect(sec.locator('.metric', { hasText: 'Red-zone carry share' }).locator('.value'))
      .toHaveText(pct(total(z, p.id, 'rzCar') / teamTotal(z, p, 'rzCar')));
    await expect(sec.locator('[data-rz-trend="rzOppShare"]')).toBeVisible();
    await expect(sec.locator('.rz-chart g[data-rz-week]')).toHaveCount(p.w.length);
    await expect(sec.locator('#rz-weekly tbody tr')).toHaveCount(p.w.length);
    await expect(page.locator('#usage-profile')).toBeVisible();
    await noOverflow(page);
    await sec.screenshot({ path: test.info().outputPath('redzone-rb-profile.png') });
  });

  test('QB profile separates passing and rushing roles', async ({ page }) => {
    const d = season(2025), z = redzone(2025);
    const qb = d.players.filter(x => x.pos === 'QB' && x.g >= 10).sort((a, b) => total(z, b.id, 'rzAtt') - total(z, a.id, 'rzAtt'))[0];
    await page.goto(`/research/players/${qb.id}?season=2025`);
    const sec = page.locator('#redzone-profile');
    await expect(sec.locator('[data-rz-group="Passing"] .metric', { hasText: 'Red-zone pass attempts' }).locator('.value')).toHaveText(String(total(z, qb.id, 'rzAtt')));
    await expect(sec.locator('[data-rz-group="Rushing"]')).toBeVisible();
    await expect(sec).toContainText('passing touchdown is not counted as a QB carry or target');
    await noOverflow(page);
  });

  test('kicker and defense profiles have no red-zone section or request', async ({ page }) => {
    const calls = track(page), d = season(2025);
    for (const pos of ['K', 'DEF']) {
      await page.goto(`/research/players/${d.players.find(x => x.pos === pos)!.id}?season=2025`);
      await expect(page.locator('#profile-summary')).toBeVisible();
      await expect(page.locator('#redzone-profile')).toHaveCount(0);
    }
    expect(calls).toEqual([]);
  });

  test('failed red-zone download leaves core and usage working', async ({ page }) => {
    await page.route('**/research/data/redzone/**', r => r.abort());
    await page.goto('/research?season=2025&pos=RB&view=redzone&sort=rzCar');
    await expect(page.locator('#usage-status')).toContainText('failed to load');
    await expect(firstName(page)).toBeVisible();
    await expect(page.locator('.missing:visible').first()).toBeVisible();
    const p = byName(2025, 'Christian McCaffrey');
    await page.goto(`/research/players/${p.id}?season=2025`);
    await expect(page.locator('#redzone-state')).toContainText('advanced usage are unaffected');
    await expect(page.locator('#usage-profile .metric').first()).toBeVisible();
    await expect(page.locator('#profile-summary .metric').first()).toBeVisible();
  });

  test('season missing from the red-zone manifest is unavailable, not zero', async ({ page }) => {
    await page.route('**/research/data/redzone/seasons.json', r => r.fulfill({ json: { schema: 1, years: [2025] } }));
    await page.goto('/research?season=2024&pos=RB&sort=rzCar');
    await expect(page.locator('#usage-status')).toContainText('not available for 2024');
    await expect(page.locator('.missing:visible').first()).toBeVisible();
  });

  test('cross-season comparison shows red-zone rates, totals context and differences', async ({ page }) => {
    const p = byName(2025, 'Christian McCaffrey'), p24 = byName(2024, 'Christian McCaffrey');
    const z24 = redzone(2024), z25 = redzone(2025);
    test.skip(!p24, 'needs a 2024 season');
    await page.goto(`/research/players/${p.id}?season=2025`);
    await expect(page.locator('#career-history')).toContainText('2024');
    await page.locator('[data-add-profile][data-year="2025"]').first().click();
    await page.locator('#career-history [data-add-profile][data-year="2024"]').click();
    const row = page.locator('#compare-detail .cmp-row[data-metric="rzCarShare"]');
    await expect(row).toContainText(pct(total(z25, p.id, 'rzCar') / teamTotal(z25, p, 'rzCar')));
    await expect(row).toContainText(pct(total(z24, p.id, 'rzCar') / teamTotal(z24, p24, 'rzCar')));
    await expect(page.locator('#compare-detail .cmp-row[data-metric="i5OppPg"]')).toBeVisible();
    await expect(page.locator('#compare-detail')).toContainText('context only');
    await noOverflow(page);
  });

  test('360px: red-zone view and profile fit the screen', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/research?season=2025&view=redzone');
    await expect(firstName(page)).toBeVisible();
    await noOverflow(page);
    const p = season(2025).players.filter(x => x.pos === 'TE' && x.g >= 10).sort((a, b) => b.g - a.g)[0];
    await page.goto(`/research/players/${p.id}?season=2025`);
    await expect(page.locator('#redzone-profile .rz-chart svg')).toBeVisible();
    await noOverflow(page);
    await page.locator('#redzone-profile').screenshot({ path: test.info().outputPath('redzone-te-360.png') });
  });
});
