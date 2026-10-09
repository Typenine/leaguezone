import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const req = createRequire(path.resolve('package.json'));
const M = req('./public/research/metrics.js');
type P = { id: string; n: string; pos: string; g: number; p: number; w: unknown[] };
const season = (y: number) => JSON.parse(readFileSync(`public/research/data/${y}.json`, 'utf8')) as { throughWeek: number; players: P[] };
const years = (JSON.parse(readFileSync('public/research/data/seasons.json', 'utf8')).years as number[]);
const latest = years[years.length - 1];

function guardPrivateCalls(page: Page) {
  const calls: string[] = [];
  page.on('request', r => {
    const p = new URL(r.url()).pathname;
    if (p.startsWith('/api/') || p.startsWith('/l/')) calls.push(p);
  });
  return calls;
}

test.describe('research profiles and comparisons', () => {
  test('profile trends match recorded-game calculations', async ({ page }) => {
    const calls = guardPrivateCalls(page);
    const d = season(2025), p = d.players.find(x => x.n === 'Christian McCaffrey')!;
    const o = { scoring: 'half', throughWeek: d.throughWeek };
    const ext = M.extremes(p, 'half'), trend = M.usageTrend(p, 'half');
    await page.goto(`/research/players/${p.id}?season=2025`);
    await expect(page.locator('#data-stamp')).toContainText('2025 Season');
    const summary = page.locator('#profile-summary');
    await expect(summary).toContainText('Last 3 games avg');
    await expect(summary).toContainText(M.format('last3', M.compute('last3', p, o)));
    await expect(summary).toContainText(M.format('last5', M.compute('last5', p, o)));
    await expect(summary).toContainText(M.format('ppg', M.compute('ppg', p, o)));
    await expect(summary).toContainText(`Week ${ext.high.week}`);
    await expect(summary).toContainText(ext.low.points.toFixed(1));
    await expect(page.locator('#recent-form')).toContainText('Wk ' + trend.recentWeeks.join(', '));
    await expect(page.locator('#position-stats')).toContainText('Yards per carry');
    await expect(page.locator('#position-stats')).toContainText(M.format('ypc', M.compute('ypc', p, o)));
    await expect(page.locator('#season-note')).toHaveCount(0);
    await expect(page.locator('.trend-chart svg')).toHaveAttribute('role', 'img');
    await page.locator('#return-list').click();
    await page.locator('#scoring').selectOption('ppr');
    await page.locator('#search').fill(p.n);
    await page.locator(`[data-profile="${p.id}"]:visible`).first().click();
    await expect(summary).toContainText('Full PPR');
    await expect(summary).toContainText(M.format('last3', M.compute('last3', p, { scoring: 'ppr' })));
    expect(calls).toEqual([]);
  });

  test('kicker and defense profiles show only their own statistics', async ({ page }) => {
    const d = season(2025);
    const k = d.players.filter(x => x.pos === 'K').sort((a, b) => b.p - a.p)[0];
    const dst = d.players.find(x => x.pos === 'DEF')!;
    await page.goto(`/research/players/${k.id}?season=2025`);
    await expect(page.locator('#position-stats')).toContainText('Field goals made');
    await expect(page.locator('#position-stats')).not.toContainText('Passing');
    await expect(page.locator('#position-stats')).not.toContainText('Targets');
    await page.goto(`/research/players/${dst.id}?season=2025`);
    await expect(page.locator('#position-stats')).toContainText('Points allowed');
    await expect(page.locator('#position-stats')).not.toContainText('Receptions');
    await expect(page.locator('#position-stats')).not.toContainText('Targets');
  });

  test('in-progress seasons are labeled for fair comparison', async ({ page }) => {
    const d = season(latest);
    test.skip(M.isSeasonComplete(latest, d.throughWeek), 'Latest season is complete');
    const p = d.players.filter(x => x.pos === 'WR').sort((a, b) => b.p - a.p)[0];
    await page.goto(`/research/players/${p.id}?season=${latest}`);
    await expect(page.locator('#season-note')).toContainText(`through Week ${d.throughWeek}`);
    await expect(page.locator('#career-history')).toContainText(`Through Week ${d.throughWeek}`);
  });

  test('same-player cross-season comparison shows labeled differences', async ({ page }) => {
    const a = season(2025).players.find(x => x.id === '00-0031381')!;
    const b = season(2024).players.find(x => x.id === '00-0031381')!;
    await page.goto('/research/players/00-0031381?season=2025');
    await expect(page.locator('#career-history')).toContainText('2024');
    await page.locator('[data-add-profile][data-year="2025"]').first().click();
    await page.locator('#career-history [data-add-profile][data-year="2024"]').click();
    await expect(page.locator('#compare-grid .panel')).toHaveCount(2);
    const detail = page.locator('#compare-detail');
    await expect(detail).toContainText('Difference (A');
    const row = detail.locator('.cmp-row[data-metric="tgtPg"]');
    const va = M.compute('tgtPg', a, {}), vb = M.compute('tgtPg', b, {});
    await expect(row).toContainText(M.format('tgtPg', va));
    await expect(row).toContainText(M.format('tgtPg', vb));
    await expect(row.locator('.cmp-diff')).toContainText(M.formatDiff('tgtPg', va - vb));
    await expect(detail.locator('.cmp-row[data-metric="catchPct"]')).toHaveCount(1);
    await expect(detail.locator('.cmp-row[data-metric="ppg"]')).toHaveCount(1);
  });

  test('unrelated positions compare fantasy output only', async ({ page }) => {
    const d = season(2025);
    const k = d.players.filter(x => x.pos === 'K').sort((x, y) => y.p - x.p)[0];
    const wr = d.players.filter(x => x.pos === 'WR').sort((x, y) => y.p - x.p)[0];
    await page.goto('/research/stats?season=2025');
    await page.locator('#position').selectOption('ALL');
    await page.locator('#search').fill(k.n);
    await page.locator(`[data-compare="${k.id}"]:visible`).check();
    await page.locator('#search').fill(wr.n);
    await page.locator(`[data-compare="${wr.id}"]:visible`).check();
    const detail = page.locator('#compare-detail');
    await expect(detail).toContainText('Different position groups (K vs WR)');
    await expect(detail.locator('.cmp-row[data-metric="ppg"]')).toHaveCount(1);
    await expect(detail.locator('.cmp-row[data-metric="tgtPg"]')).toHaveCount(0);
    await expect(detail.locator('.cmp-row[data-metric="fgmPg"]')).toHaveCount(0);
  });

  test('comparison fits a narrow phone without horizontal scrolling', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-specific layout');
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/research/players/00-0031381?season=2025');
    await expect(page.locator('#career-history')).toContainText('2024');
    await page.locator('[data-add-profile][data-year="2025"]').first().click();
    await page.locator('#career-history [data-add-profile][data-year="2024"]').click();
    await expect(page.locator('#compare-detail .cmp-row[data-metric="tgtPg"]')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.locator('#compare-panel').screenshot({ path: test.info().outputPath('research-compare-360.png') });
  });
});
