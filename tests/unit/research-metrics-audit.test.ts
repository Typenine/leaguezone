import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

// Independent audit fixtures. Every expected value below was worked out by hand
// from the raw rows in this file, not produced by the helper under test.
const require = createRequire(import.meta.url);
const M = require('../../public/research/metrics.js');

type Row = (string | number)[];
// Skill row: [week, team, pprPts, rec, tgt, recYds, car, rushYds, passYds, passTD, passINT, fgm, xpm, rushTD, recTD]
// DST row:   [week, team, pts, 0 x10, sacks, ints, fumbleRecoveries, pointsAllowed]
const calc = (key: string, p: object, scoring = 'ppr', row?: Row) => M.compute(key, p, { scoring, row });
const base = { ppyd: 0, pptd: 0, pint: 0, fgm: 0, xpm: 0, rut: 0, rt: 0 };
const sk = (wk: number, team: string, pts: number, rec = 0, tgt = 0, ry = 0, car = 0, ruy = 0): Row =>
  [wk, team, pts, rec, tgt, ry, car, ruy, 0, 0, 0, 0, 0, 0, 0];

// RB, bye in week 4. Season totals written out by hand.
const rb = {
  ...base, id: 'RB1', n: 'Bye Back', pos: 'RB', team: 'SF', g: 5, p: 75, rec: 15, tgt: 19, ry: 125, car: 65, ruy: 300,
  w: [sk(1, 'SF', 20, 4, 5, 30, 15, 80), sk(2, 'SF', 10, 2, 2, 10, 10, 40), sk(3, 'SF', 15, 3, 4, 25, 12, 50),
    sk(5, 'SF', 5, 0, 1, 0, 8, 30), sk(6, 'SF', 25, 6, 7, 60, 20, 100)],
};
// WR traded mid-season (LV -> JAX), zero-target week with negative points.
const wr = {
  ...base, id: 'WR1', n: 'Traded Wideout', pos: 'WR', team: 'JAX', g: 4, p: 34.5, rec: 13, tgt: 20, ry: 195, car: 1, ruy: -3,
  w: [sk(1, 'LV', 12.5, 5, 8, 75), sk(2, 'LV', -1, 0, 0, 0, 1, -3), sk(3, 'JAX', 20, 6, 9, 110), sk(4, 'JAX', 3, 2, 3, 10)],
};
// TE with only two recorded games (weeks 7 and 9), stored out of order.
const te = {
  ...base, id: 'TE1', n: 'Spot Tight End', pos: 'TE', team: 'KC', g: 2, p: 10, rec: 4, tgt: 5, ry: 60, car: 0, ruy: 0,
  w: [sk(9, 'KC', 2, 1, 1, 10), sk(7, 'KC', 8, 3, 4, 50)],
};
const qb = {
  ...base, id: 'QB1', n: 'Dual Passer', pos: 'QB', team: 'BUF', g: 3, p: 66, rec: 0, tgt: 0, ry: 0, car: 13, ruy: 65,
  ppyd: 820, pptd: 6, pint: 3, rut: 1,
  w: [[1, 'BUF', 22, 0, 0, 0, 4, 20, 280, 2, 1, 0, 0, 0, 0], [2, 'BUF', 14, 0, 0, 0, 6, 35, 190, 1, 0, 0, 0, 0, 0],
    [3, 'BUF', 30, 0, 0, 0, 3, 10, 350, 3, 2, 0, 0, 1, 0]] as Row[],
};
const k = {
  ...base, id: 'K1', n: 'Leg', pos: 'K', team: 'BAL', g: 3, p: 25, rec: 0, tgt: 0, ry: 0, car: 0, ruy: 0, fgm: 5, xpm: 7,
  w: [[1, 'BAL', 10, 0, 0, 0, 0, 0, 0, 0, 0, 2, 4, 0, 0], [2, 'BAL', 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
    [3, 'BAL', 14, 0, 0, 0, 0, 0, 0, 0, 0, 3, 2, 0, 0]] as Row[],
};
const d0 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const dst = {
  ...base, id: 'DEF-PIT', n: 'PIT Defense', pos: 'DEF', team: 'PIT', g: 3, p: 18, rec: 0, tgt: 0, ry: 0, car: 0, ruy: 0,
  sacks: 7.5, ints: 2, fr: 1, pa: 54,
  w: [[1, 'PIT', 9, ...d0, 3, 1, 1, 17], [2, 'PIT', -1, ...d0, 1.5, 0, 0, 31], [3, 'PIT', 10, ...d0, 3, 1, 0, 6]] as Row[],
};

describe('audit: per-game and efficiency formulas (RB, bye week 4)', () => {
  it('uses 5 recorded games, not 6 calendar weeks', () => {
    expect(calc('games', rb)).toBe(5);
    expect(calc('ppg', rb, 'ppr')).toBeCloseTo(15.0, 10);
    expect(calc('ppg', rb, 'half')).toBeCloseTo(13.5, 10); // (75 - 0.5 * 15) / 5
    expect(calc('ppg', rb, 'standard')).toBeCloseTo(12.0, 10); // (75 - 15) / 5
    expect(calc('tgtPg', rb)).toBeCloseTo(3.8, 10);
    expect(calc('recPg', rb)).toBeCloseTo(3.0, 10);
    expect(calc('carPg', rb)).toBeCloseTo(13.0, 10);
    expect(calc('touchPg', rb)).toBeCloseTo(16.0, 10); // (65 + 15) / 5
  });
  it('computes efficiency from totals with explicit denominators', () => {
    expect(calc('ypc', rb)).toBeCloseTo(300 / 65, 10);
    expect(calc('ypt', rb)).toBeCloseTo(125 / 19, 10);
    expect(calc('ypr', rb)).toBeCloseTo(125 / 15, 10);
    expect(calc('catchPct', rb)).toBeCloseTo(15 / 19, 10);
    expect(calc('ypTouch', rb)).toBeCloseTo(425 / 80, 10);
  });
  it('rolling averages skip the bye instead of scoring it as zero', () => {
    expect(calc('last3', rb, 'ppr')).toBeCloseTo(15.0, 10); // weeks 3, 5, 6 -> (15 + 5 + 25) / 3
    expect(calc('last3', rb, 'half')).toBeCloseTo(13.5, 10); // 13.5, 5, 22
    expect(calc('last5', rb, 'ppr')).toBeCloseTo(15.0, 10);
  });
  it('season high/low, population SD and volatility', () => {
    expect(calc('high', rb, 'ppr')).toBe(25);
    expect(calc('low', rb, 'ppr')).toBe(5);
    expect(calc('high', rb, 'standard')).toBe(19); // 25 - 6 receptions
    expect(calc('sd', rb, 'ppr')).toBeCloseTo(Math.sqrt(50), 10); // deviations 5,-5,0,-10,10
    expect(calc('volatility', rb, 'ppr')).toBeCloseTo(Math.sqrt(50) / 15, 10);
  });
  it('recent usage compares the last 3 recorded games with all earlier ones', () => {
    const t = M.usageTrend(rb, 'ppr');
    expect(t.recentWeeks).toEqual([3, 5, 6]);
    expect(t.priorWeeks).toEqual([1, 2]);
    const get = (key: string) => t.metrics.find((m: { key: string }) => m.key === key);
    expect(get('ppg').change).toBeCloseTo(0, 10); // 15 vs 15
    expect(get('tgtPg').recent).toBeCloseTo(4.0, 10); // (4 + 1 + 7) / 3
    expect(get('tgtPg').prior).toBeCloseTo(3.5, 10); // (5 + 2) / 2
    expect(get('carPg').change).toBeCloseTo(40 / 3 - 12.5, 10);
  });
});

describe('audit: edge cases', () => {
  it('traded WR keeps all games; a zero-target week is missing, not 0%', () => {
    expect(calc('games', wr)).toBe(4);
    expect(calc('catchPct', wr)).toBeCloseTo(0.65, 10);
    expect(calc('ypt', wr)).toBeCloseTo(9.75, 10);
    expect(calc('ypr', wr)).toBeCloseTo(15.0, 10);
    expect(calc('ypc', wr)).toBeCloseTo(-3.0, 10);
    expect(calc('catchPct', wr, 'ppr', wr.w[1])).toBeNull();
    expect(M.evaluate('ypt', wr, { scoring: 'ppr', row: wr.w[1] }).missing).toBe('No targets recorded');
  });
  it('negative fantasy games count in averages and lows', () => {
    expect(calc('last3', wr, 'ppr')).toBeCloseTo((-1 + 20 + 3) / 3, 10);
    expect(calc('low', wr, 'ppr')).toBe(-1);
    expect(calc('low', wr, 'standard')).toBe(-1);
    expect(calc('last5', wr)).toBeNull();
  });
  it('fewer than 3 games: no rolling average or consistency, high/low still exist', () => {
    expect(calc('ppg', te)).toBeCloseTo(5.0, 10);
    expect(calc('last3', te)).toBeNull();
    expect(calc('sd', te)).toBeNull();
    expect(calc('volatility', te)).toBeNull();
    expect(M.evaluate('sd', te, { scoring: 'ppr' }).missing).toBe('Fewer than 3 recorded games');
    expect(calc('high', te)).toBe(8);
    expect(calc('low', te)).toBe(2);
    expect(M.usageTrend(te, 'ppr')).toBeNull();
  });
  it('QB: passing and rushing, no receiving metrics', () => {
    expect(calc('ppg', qb, 'standard')).toBeCloseTo(22.0, 10);
    expect(calc('ppydPg', qb)).toBeCloseTo(820 / 3, 10);
    expect(calc('pptdPg', qb)).toBeCloseTo(2.0, 10);
    expect(calc('pintPg', qb)).toBeCloseTo(1.0, 10);
    expect(calc('ypc', qb)).toBeCloseTo(5.0, 10);
    expect(calc('sd', qb)).toBeCloseTo(Math.sqrt(128 / 3), 10);
    expect(calc('targets', qb)).toBeNull();
    expect(calc('catchPct', qb)).toBeNull();
  });
  it('kicker: kicking only', () => {
    expect(calc('fgmPg', k)).toBeCloseTo(5 / 3, 10);
    expect(calc('xpmPg', k)).toBeCloseTo(7 / 3, 10);
    expect(calc('passing', k)).toBeNull();
    expect(calc('targets', k)).toBeNull();
    expect(calc('carPg', k)).toBeNull();
  });
  it('defense: takeaways and points allowed, no receiving metrics', () => {
    expect(calc('sacksPg', dst)).toBeCloseTo(2.5, 10);
    expect(calc('paPg', dst)).toBeCloseTo(18.0, 10);
    expect(calc('ppg', dst, 'standard')).toBeCloseTo(6.0, 10);
    expect(calc('low', dst)).toBe(-1);
    expect(calc('pa', dst, 'ppr', dst.w[1])).toBe(31);
    expect(calc('receptions', dst)).toBeNull();
    expect(calc('catchPct', dst)).toBeNull();
  });
});

describe('audit: comparison differences', () => {
  it('RB vs WR compares shared skill metrics with labeled A-B differences', () => {
    const plan = M.comparisonPlan('RB', 'WR');
    expect(plan.positional).toContain('catchPct');
    expect(plan.positional).toContain('tgtPg');
    expect(M.formatDiff('catchPct', calc('catchPct', rb) - calc('catchPct', wr))).toBe('+13.9 pts'); // 78.95% - 65%
    expect(M.formatDiff('tgtPg', calc('tgtPg', rb) - calc('tgtPg', wr))).toBe('\u22121.2'); // 3.8 - 5.0
    expect(M.formatDiff('ppg', calc('ppg', rb) - calc('ppg', wr))).toBe('+6.4'); // 15 - 8.625
  });
  it('unrelated positions compare fantasy output only', () => {
    expect(M.comparisonPlan('QB', 'RB').positional).toEqual([]);
    expect(M.comparisonPlan('K', 'DEF').positional).toEqual([]);
  });
});
