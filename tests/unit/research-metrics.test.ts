import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const M = require('../../public/research/metrics.js');

type Row = (string | number)[];
// Skill row: [week, team, pprPts, rec, tgt, recYds, car, rushYds, passYds, passTD, passINT, fgm, xpm, rushTD, recTD]
const skillRow = (week: number, pts: number, rec = 0, tgt = 0, ry = 0, car = 0, ruy = 0): Row =>
  [week, 'SF', pts, rec, tgt, ry, car, ruy, 0, 0, 0, 0, 0, 0, 0];
function player(pos: string, rows: Row[], extra: Record<string, unknown> = {}) {
  const sum = (i: number) => rows.reduce((s, r) => s + Number(r[i]), 0);
  return {
    id: 'X', n: 'Test', pos, team: 'SF', g: rows.length, p: sum(2), rec: sum(3), tgt: sum(4), ry: sum(5),
    car: sum(6), ruy: sum(7), ppyd: sum(8), pptd: sum(9), pint: sum(10), fgm: sum(11), xpm: sum(12),
    rut: sum(13), rt: sum(14), w: rows, ...extra,
  };
}
// Weeks 1-4 and 6-7 recorded; week 5 is a bye and must not count as zero.
const rb = player('RB', [
  skillRow(7, 30, 5, 6, 50, 20, 100), skillRow(1, 10, 2, 4, 20, 10, 40), skillRow(2, 20, 4, 5, 30, 15, 70),
  skillRow(3, 5, 1, 2, 5, 8, 20), skillRow(4, 15, 3, 3, 25, 12, 60), skillRow(6, 12, 2, 2, 10, 14, 50),
]);

describe('research metrics: scoring', () => {
  it('adjusts nflverse PPR points by reception value', () => {
    expect(M.receptionAdjustment('ppr')).toBe(0);
    expect(M.receptionAdjustment('half')).toBe(0.5);
    expect(M.receptionAdjustment('standard')).toBe(1);
    expect(M.compute('points', rb, { scoring: 'ppr' })).toBe(92);
    expect(M.compute('points', rb, { scoring: 'half' })).toBe(92 - 8.5);
    expect(M.compute('points', rb, { scoring: 'standard' })).toBe(92 - 17);
  });
  it('season total equals the sum of weekly points in every scoring format', () => {
    for (const s of ['ppr', 'half', 'standard']) {
      const weekly = M.weeklyPoints(rb, s).reduce((t: number, g: { points: number }) => t + g.points, 0);
      expect(M.compute('points', rb, { scoring: s })).toBeCloseTo(weekly, 10);
    }
  });
});

describe('research metrics: per-game and efficiency denominators', () => {
  it('divides season totals by recorded games', () => {
    expect(M.compute('ppg', rb, { scoring: 'ppr' })).toBeCloseTo(92 / 6);
    expect(M.compute('tgtPg', rb, {})).toBeCloseTo(22 / 6);
    expect(M.compute('recPg', rb, {})).toBeCloseTo(17 / 6);
    expect(M.compute('carPg', rb, {})).toBeCloseTo(79 / 6);
    expect(M.compute('touchPg', rb, {})).toBeCloseTo((79 + 17) / 6);
  });
  it('uses the correct numerator and denominator for rates', () => {
    expect(M.compute('ypc', rb, {})).toBeCloseTo(340 / 79);
    expect(M.compute('ypt', rb, {})).toBeCloseTo(140 / 22);
    expect(M.compute('ypr', rb, {})).toBeCloseTo(140 / 17);
    expect(M.compute('catchPct', rb, {})).toBeCloseTo(17 / 22);
    expect(M.format('catchPct', 17 / 22)).toBe('77.3%');
  });
  it('reports zero denominators as missing, never zero', () => {
    const noTargets = player('WR', [skillRow(1, 0), skillRow(2, 0)]);
    for (const key of ['ypt', 'ypr', 'catchPct']) {
      const r = M.evaluate(key, noTargets, {});
      expect(r.value).toBeNull();
      expect(r.missing).toMatch(/No (targets|receptions) recorded/);
    }
    expect(M.ratio(5, 0)).toBeNull();
    expect(M.format('ypc', null)).toBeNull();
  });
  it('treats absent numeric fields as zero volume, so rates stay missing', () => {
    const sparse = { id: 'Y', n: 'Sparse', pos: 'RB', team: 'SF', g: 1, p: 3, w: [skillRow(1, 3)] };
    expect(M.evaluate('ypc', sparse, {}).value).toBeNull();
    expect(M.compute('carPg', sparse, {})).toBe(0);
  });
});

describe('research metrics: recent form, consistency and extremes', () => {
  it('averages the last N recorded games in week order, skipping byes', () => {
    // Recorded order 1,2,3,4,6,7. Last 3 = weeks 4,6,7 (15,12,30), not a zero for week 5.
    expect(M.recentAverage(rb, 3, 'ppr')).toBeCloseTo(19);
    expect(M.recentAverage(rb, 5, 'ppr')).toBeCloseTo((20 + 5 + 15 + 12 + 30) / 5);
    expect(M.recentAverage(rb, 3, 'standard')).toBeCloseTo((12 + 10 + 25) / 3);
  });
  it('returns missing when fewer games than the window', () => {
    const short = player('WR', [skillRow(1, 10, 1, 2, 10), skillRow(3, 8, 1, 1, 9)]);
    expect(M.evaluate('last3', short, {}).value).toBeNull();
    expect(M.evaluate('last3', short, {}).missing).toBe('Fewer than 3 recorded games');
  });
  it('computes population standard deviation over recorded games', () => {
    const c = M.consistency(rb, 'ppr');
    const values = [10, 20, 5, 15, 12, 30], avg = 92 / 6;
    const sd = Math.sqrt(values.reduce((s, v) => s + (v - avg) ** 2, 0) / 6);
    expect(c.games).toBe(6);
    expect(c.sd).toBeCloseTo(sd);
    expect(c.volatility).toBeCloseTo(sd / avg);
    expect(M.consistency(player('RB', [skillRow(1, 5), skillRow(2, 9)]), 'ppr').sd).toBeNull();
  });
  it('finds single-game highs and lows with their weeks', () => {
    const e = M.extremes(rb, 'ppr');
    expect(e.high).toEqual({ week: 7, points: 30 });
    expect(e.low).toEqual({ week: 3, points: 5 });
    expect(M.extremes(player('RB', []), 'ppr')).toEqual({ high: null, low: null });
  });
  it('compares the last 3 recorded games against earlier games', () => {
    const t = M.usageTrend(rb, 'ppr');
    expect(t.recentWeeks).toEqual([4, 6, 7]);
    expect(t.priorWeeks).toEqual([1, 2, 3]);
    const carries = t.metrics.find((m: { key: string }) => m.key === 'carPg');
    expect(carries.recent).toBeCloseTo((12 + 14 + 20) / 3);
    expect(carries.prior).toBeCloseTo((10 + 15 + 8) / 3);
    expect(M.usageTrend(player('RB', [skillRow(1, 1), skillRow(2, 1), skillRow(3, 1), skillRow(4, 1)]), 'ppr')).toBeNull();
  });
});
