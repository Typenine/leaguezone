import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Expectations are computed here from the raw published files (not through
// the app's helpers) so the profile is checked against an independent oracle.
type Row = [number, string, number, number, number, ...number[]];
type P = { id: string; n: string; pos: string; team: string; g: number; p: number; rec: number; ryr: number | null; w: Row[] };
type D = { year: number; throughWeek: number; players: P[] };
const years = (JSON.parse(readFileSync('public/research/data/seasons.json', 'utf8')).years as number[]);
const latest = years[years.length - 1], previous = years[years.length - 2];
const season = (y: number) => JSON.parse(readFileSync(`public/research/data/${y}.json`, 'utf8')) as D;
const teamsOf = (p: P) => [...new Set([...p.w].sort((a, b) => a[0] - b[0]).map(w => w[1]))];
const halfPpg = (p: P) => (p.p - 0.5 * p.rec) / p.g;
test.use({ serviceWorkers: 'block' });

async function noOverflow(page: Page) {
  const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(sw).toBeLessThanOrEqual(cw + 1);
}
async function openCareer(page: Page) {
  await page.locator('.profile-nav a[data-jump="profile-career"]').click();
  await expect(page.locator('#career-history')).not.toContainText('load when you reach');
}

test.describe('player hub', () => {
  test('header, sections and position rank for a historical WR', async ({ page }) => {
    const d = season(previous), min = Math.ceil(d.throughWeek / 2);
    const pool = d.players.filter(p => p.pos === 'WR' && p.g >= min).sort((a, b) => halfPpg(b) - halfPpg(a));
    const p = pool[2];
    await page.goto(`/research/players/${p.id}?season=${previous}`);
    const facts = page.locator('.profile-facts');
    await expect(facts).toContainText(`${previous} season`);
    await expect(facts).toContainText('Historical season');
    await expect(facts).toContainText(`Data through Week ${d.throughWeek}`);
    for (const name of ['Overview', 'Production', 'Opportunity', 'Career', 'Game log', 'Compare'])
      await expect(page.locator('.profile-nav')).toContainText(name);
    const rank = page.locator('#profile-overview .rank-list li').first();
    await expect(rank).toContainText(`3rd of ${pool.length} qualified WRs`);
    await expect(page.locator('#profile-overview')).toContainText(`at least ${min} games`);
    await expect(page.locator('#profile-overview a[href*="/research/development"]')).toHaveAttribute('href', new RegExp(`player=${p.id}`));
  });

  test('current season is labelled in progress with partial ranks', async ({ page }) => {
    const d = season(latest);
    const p = d.players.filter(x => x.pos === 'QB').sort((a, b) => b.g - a.g || b.p - a.p)[0];
    await page.goto(`/research/players/${p.id}?season=${latest}`);
    await expect(page.locator('.profile-facts')).toContainText(`Through Week ${d.throughWeek}`);
    await expect(page.locator('#profile-overview')).toContainText('ranks are partial');
    await expect(page.locator('#chart-metric option')).toContainText(['Fantasy points', 'Passing yards']);
    await expect(page.locator('#chart-metric')).not.toContainText('Targets');
  });

  test('weekly chart switches metrics and shows byes as no game', async ({ page }) => {
    const d = season(previous);
    const p = d.players.filter(x => x.pos === 'WR' && x.g >= 10 && x.g < d.throughWeek - 1).sort((a, b) => b.p - a.p)[0];
    const played = new Map(p.w.map(w => [w[0], w[4]]));
    const gap = Array.from({ length: d.throughWeek }, (_, i) => i + 1).find(w => !played.has(w))!;
    await page.goto(`/research/players/${p.id}?season=${previous}`);
    await expect(page.locator('.trend-chart svg')).toHaveAttribute('role', 'img');
    await page.locator('#chart-metric').selectOption('targets');
    await expect(page.locator('#chart-body .bar-chart svg').first()).toHaveAttribute('aria-label', /weekly targets/);
    await page.locator('#chart-body .chart-data summary').click();
    const rows = page.locator('#chart-body .chart-data tbody tr');
    await expect(rows).toHaveCount(d.throughWeek);
    const first = p.w[0];
    await expect(rows.nth(first[0] - 1)).toContainText(String(first[4]));
    await expect(rows.nth(gap - 1)).toContainText('No game');
    await expect(page.locator('#chart-body .bar-chart.fp')).toHaveCount(1);
  });

  test('fantasy points never draw a line across an unrecorded week', async ({ page }) => {
    const d = season(previous);
    const p = d.players.find(x => {
      if (x.pos !== 'WR' || x.w.length < 8) return false;
      const weeks = x.w.map(w => w[0]).sort((a, b) => a - b);
      return weeks.some((week, i) => i >= 3 && i < weeks.length - 2 && week > weeks[i - 1] + 1);
    })!;
    expect(p).toBeDefined();
    const weeks = p.w.map(w => w[0]).sort((a, b) => a - b);
    const i = weeks.findIndex((week, index) => index >= 3 && index < weeks.length - 2 && week > weeks[index - 1] + 1);
    const gap = weeks[i - 1] + 1;
    await page.goto(`/research/players/${p.id}?season=${previous}`);
    await expect(page.locator('.trend-chart svg')).toBeVisible();
    await expect(page.locator('.trend-chart .gap-mark title').filter({ hasText: 'Week ' + gap + ': no recorded game' })).toHaveCount(1);
    const lines = await page.locator('.trend-chart polyline').evaluateAll(nodes =>
      nodes.map(node => (node.getAttribute('points') || '').split(' ').filter(Boolean)
        .map(pair => Number(pair.split(',')[0]))));
    const gapX = 36 + (gap - 1) / (d.throughWeek - 1) * (720 - 36 - 15);
    expect(lines.some(line => line.length >= 2)).toBe(true);
    for (const line of lines) expect(Math.min(...line) < gapX && Math.max(...line) > gapX).toBe(false);
  });

  test('traded player shows both teams and per-week teams', async ({ page }) => {
    const d = season(previous);
    const p = d.players.find(x => teamsOf(x).length > 1 && x.g >= 6)!;
    test.skip(!p, 'no traded player in this season');
    await page.goto(`/research/players/${p.id}?season=${previous}`);
    await expect(page.locator('.profile-facts')).toContainText(teamsOf(p).join(' \u2192 '));
    await expect(page.locator('#profile')).toContainText(`Played for ${teamsOf(p).join(' and ')}`);
  });

  test('kicker and defense charts only offer their own statistics', async ({ page }) => {
    const d = season(previous);
    for (const pos of ['K', 'DEF']) {
      const p = d.players.filter(x => x.pos === pos).sort((a, b) => b.g - a.g)[0];
      await page.goto(`/research/players/${p.id}?season=${previous}`);
      await expect(page.locator('.profile-facts')).toContainText(`${previous} season`);
      const options = await page.locator('#chart-metric option').evaluateAll(o => o.map(x => (x as HTMLOptionElement).value));
      expect(options).toEqual(pos === 'K' ? ['points', 'fgm', 'xpm'] : ['points', 'sacks', 'pa']);
      await expect(page.locator('#profile-overview')).not.toContainText('Opportunity Radar signal');
    }
  });

  test('minimal history is not ranked and advanced usage failure is unavailable, not zero', async ({ page }) => {
    await page.route('**/research/data/usage/**', r => r.abort());
    const d = season(previous);
    const p = d.players.find(x => x.pos === 'WR' && x.g === 1)!;
    await page.goto(`/research/players/${p.id}?season=${previous}`);
    await expect(page.locator('#profile-overview .rank-list').first()).toContainText(`Not ranked: Needs ${Math.ceil(d.throughWeek / 2)}+ games`);
    await expect(page.locator('#profile-overview')).toContainText(/needs at least 5 games/i);
    await page.locator('#chart-metric').selectOption('tgtShare');
    await expect(page.locator('#chart-state')).toBeVisible();
    await expect(page.locator('#chart-body svg')).toHaveCount(0);
  });

  test('career loads lazily, skips pre-rookie seasons and compares seasons', async ({ page }) => {
    const d = season(latest), prior = season(previous);
    const p = d.players.find(x => x.ryr === previous && prior.players.some(y => y.id === x.id) && x.g >= 2)!;
    test.skip(!p, 'no second-year player available');
    const loaded: string[] = [];
    page.on('request', r => { const m = r.url().match(/research\/data\/(\d{4})\.json/); if (m) loaded.push(m[1]); });
    await page.goto(`/research/players/${p.id}?season=${latest}`);
    await expect(page.locator('#overview-history')).toContainText(`FP/G ${previous}`);
    await openCareer(page);
    await expect(page.locator('#career-history thead')).toContainText('PPG \u0394');
    await expect(page.locator('#career-history tbody tr')).toHaveCount(2);
    expect(loaded.filter(y => Number(y) < previous)).toEqual([]);
    await page.locator('#career-compare-go').click();
    await expect(page.locator('#compare-panel')).toBeVisible();
    await expect(page.locator('#compare-panel')).toContainText(String(previous));
    await page.locator('#career-a').selectOption(String(previous));
    await page.locator('#career-b').selectOption(String(latest));
    await page.locator('#career-compare-go').click();
    await expect(page.locator('#compare-grid .compare-card').first()).toContainText(String(previous));
    await expect(page.locator('#compare-grid .compare-card').nth(1)).toContainText(String(latest));
  });

  test('direct links and back/forward keep the season', async ({ page }) => {
    const d = season(previous);
    const p = d.players.filter(x => x.pos === 'RB' && x.ryr != null && x.ryr < previous).sort((a, b) => b.p - a.p)[0];
    await page.goto(`/research/players/${p.id}?season=${previous}`);
    await openCareer(page);
    const older = page.locator('#career-history a[data-career-nav]').first();
    const href = (await older.getAttribute('href'))!;
    await older.click();
    await expect.poll(() => page.url()).toContain(href);
    await page.goBack();
    await expect.poll(() => page.url()).toContain(`season=${previous}`);
    await expect(page.locator('.profile-facts')).toContainText(`${previous} season`);
    await page.goForward();
    await expect.poll(() => page.url()).toContain(href);
  });

  for (const width of [390, 320]) test(`${width}px profile fits and controls are tappable`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const p = season(previous).players.filter(x => x.pos === 'TE').sort((a, b) => b.p - a.p)[0];
    await page.goto(`/research/players/${p.id}?season=${previous}`);
    await expect(page.locator('#profile-overview')).toBeVisible();
    await noOverflow(page);
    for (const sel of ['.profile-nav a >> nth=0', '#chart-metric', '#lz-save-view'])
      expect((await page.locator(sel).boundingBox())!.height).toBeGreaterThanOrEqual(36);
    await page.locator('#chart-metric').selectOption('targets');
    await noOverflow(page);
    await openCareer(page);
    await noOverflow(page);
  });
});

test('global search loads players only after typing and labels backup data', async ({ page }) => {
  const seen: string[] = [];
  page.on('request', r => { if (/\/research\/data\/\d{4}\.json/.test(r.url())) seen.push(r.url()); });
  await page.route('**/*.workers.dev/**', r => r.abort());
  await page.goto('/search');
  await expect(page.locator('#lz-search')).toBeVisible();
  await page.waitForTimeout(500);
  expect(seen).toEqual([]);
  const p = season(latest).players.filter(x => x.pos === 'WR').sort((a, b) => b.p - a.p)[0];
  await page.locator('#lz-search').fill(p.n.slice(0, 5));
  await expect(page.getByText(`Player directory uses the ${latest} static research backup`)).toBeVisible();
  await expect(page.locator(`a[href="/research/players/${p.id}?season=${latest}"]`)).toBeVisible();
  expect(seen.length).toBe(1);
});
