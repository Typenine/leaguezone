import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const req = createRequire(path.resolve('package.json'));
const M = req('./public/research/metrics.js');
type P = { id: string; n: string; pos: string; g: number; tgt?: number; ryr?: number | null; w: unknown[] };
const season = (y: number) => JSON.parse(readFileSync(`public/research/data/${y}.json`, 'utf8')) as { throughWeek: number; players: P[] };

function guardPrivateCalls(page: Page) {
  const calls: string[] = [];
  page.on('request', r => {
    const p = new URL(r.url()).pathname;
    if (p.startsWith('/api/') || p.startsWith('/l/')) calls.push(p);
  });
  return calls;
}

test.describe('research statistical explorer', () => {
  test('sorts by a new per-game metric using recorded-game denominators', async ({ page, isMobile }) => {
    const calls = guardPrivateCalls(page);
    const d = season(2025), o = { scoring: 'half', throughWeek: d.throughWeek };
    const rbs = d.players.filter(p => p.pos === 'RB' && p.g >= 1);
    rbs.sort((a, b) => M.compareValues(M.compute('touchPg', a, o), M.compute('touchPg', b, o), 'desc') || a.n.localeCompare(b.n));
    const top = rbs[0];
    await page.goto('/research/stats?season=2025&pos=RB&sort=touchPg');
    await expect(page.locator('#data-stamp')).toContainText('2025 Season');
    await expect(page.locator('#sort')).toHaveValue('touchPg');
    await expect(page.locator('#sort-context')).toContainText('Touches per game');
    await expect(page.locator('#sort-context')).toContainText('Half PPR');
    const expected = M.format('touchPg', M.compute('touchPg', top, o));
    if (isMobile) {
      const card = page.locator('.mobile-result').first();
      await expect(card).toContainText(top.n);
      await expect(card.locator('.sorted-stat')).toContainText(expected);
    } else {
      const row = page.locator('#players-body tr').first();
      await expect(row).toContainText(top.n);
      await expect(row.locator('td.sorted')).toHaveText(expected);
      await expect(page.locator('th[aria-sort="descending"]')).toContainText('Touch/G');
    }
    expect(calls).toEqual([]);
  });

  test('shows position-appropriate metrics only', async ({ page }) => {
    await page.goto('/research/stats?season=2025');
    await expect(page.locator('#data-stamp')).toContainText('2025 Season');
    const head = page.locator('#players-head');
    await page.locator('#position').selectOption('RB');
    for (const t of ['Car/G', 'YPC', 'Tgt/G', 'Catch %', 'Touch/G', 'L3 avg', 'Wk SD']) await expect(head).toContainText(t);
    await page.locator('#position').selectOption('WR');
    for (const t of ['Y/Tgt', 'Y/Rec', 'Catch %']) await expect(head).toContainText(t);
    await page.locator('#position').selectOption('K');
    await expect(head).toContainText('FG made');
    for (const t of ['Pass', 'Targets', 'Catch', 'Car']) await expect(head).not.toContainText(t);
    await expect(page.locator('#sort option[value="ppydPg"]')).toHaveCount(0);
    await page.locator('#position').selectOption('DEF');
    await expect(head).toContainText('Pts allowed');
    for (const t of ['Targets', 'Rec', 'Catch', 'YPC']) await expect(head).not.toContainText(t);
    await expect(page.locator('#sort option[value="catchPct"]')).toHaveCount(0);
    await page.locator('#position').selectOption('QB');
    await expect(head).toContainText('Pass yds/G');
    await expect(head).not.toContainText('Catch %');
  });

  test('weekly mode never mixes season-only metrics into single-game rankings', async ({ page }) => {
    await page.goto('/research/stats?season=2025&pos=WR&sort=last3');
    await expect(page.locator('#sort')).toHaveValue('last3');
    await page.locator('#week').selectOption('4');
    await expect(page.locator('#directory-title')).toContainText('Week 4');
    await expect(page.locator('#sort')).toHaveValue('points');
    for (const key of ['last3', 'last5', 'ppg', 'sd', 'tgtPg']) await expect(page.locator(`#sort option[value="${key}"]`)).toHaveCount(0);
    await expect(page.locator('#sort option[value="catchPct"]')).toHaveCount(1);
    await expect(page.locator('#sort-context')).toContainText('Week 4 single-game stats');
    await expect(page).toHaveURL(/week=4/);
  });

  test('scoring changes flow through tables and the sorted context', async ({ page, isMobile }) => {
    const d = season(2025);
    const p = d.players.find(x => x.n === 'Christian McCaffrey')!;
    await page.goto('/research/stats?season=2025&pos=RB&q=Christian%20McCaffrey');
    await expect(page.locator('#data-stamp')).toContainText('2025 Season');
    const where = isMobile ? page.locator('#mobile-results') : page.locator('#players-body');
    for (const s of ['standard', 'half', 'ppr']) {
      await page.locator('#scoring').selectOption(s);
      await expect(where).toContainText(M.compute('points', p, { scoring: s }).toFixed(1));
      if (!isMobile) await expect(where).toContainText(M.format('last3', M.compute('last3', p, { scoring: s })));
    }
    await expect(page.locator('#sort-context')).toContainText('Full PPR');
  });

  test('missing efficiency values are labeled, not shown as zero', async ({ page }) => {
    const d = season(2025);
    const p = d.players.find(x => x.pos === 'RB' && x.g >= 1 && !x.tgt && /^[A-Za-z .'-]+$/.test(x.n))!;
    test.skip(!p, 'No zero-target RB in snapshot');
    await page.goto('/research/stats?season=2025&pos=RB&q=' + encodeURIComponent(p.n));
    await expect(page.locator('#data-stamp')).toContainText('2025 Season');
    await expect(page.locator('#players-body tr').first()).toContainText(p.n);
    await expect(page.locator('#players-body tr').first().locator('.missing').first()).toContainText('No targets recorded');
  });

  test('rookie filter stays accurate with new sorting, and filters survive the round trip to a profile', async ({ page, isMobile }) => {
    const d = season(2025);
    const rookies = d.players.filter(p => p.pos === 'WR' && p.ryr === 2025 && p.g >= 1).length;
    await page.goto('/research/players?season=2025&pos=WR&rookies=1&sort=tgtPg&scoring=ppr');
    await expect(page.locator('#data-stamp')).toContainText('2025 Season');
    await expect(page.locator('#rookies')).toBeChecked();
    await expect(page.locator('#result-count')).toHaveText(rookies + ' players');
    await expect(page.locator('#sort-context')).toContainText('Verified rookies only');
    const opener = isMobile ? page.locator('.mobile-result [data-profile]').first() : page.locator('#players-body [data-profile]').first();
    await opener.click();
    await expect(page.locator('#profile')).toBeVisible();
    await page.locator('#return-list').click();
    await expect(page).toHaveURL(/\/research\/players\?/);
    await expect(page).toHaveURL(/pos=WR/);
    await expect(page).toHaveURL(/sort=tgtPg/);
    await expect(page.locator('#sort')).toHaveValue('tgtPg');
    await expect(page.locator('#scoring')).toHaveValue('ppr');
    await expect(page.locator('#rookies')).toBeChecked();
    await page.locator('#reset-filters').click();
    await expect(page.locator('#rookies')).not.toBeChecked();
    await expect(page.locator('#sort')).toHaveValue('points');
  });
});
