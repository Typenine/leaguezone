import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const M = require('../../public/research/metrics.js');

// Expected values are worked out by hand from the fixture numbers, not by
// calling the helper. Player rows: [week, team, rzCar, i10Car, i5Car, rzRuTd,
// i10RuTd, i5RuTd, rzTgt, i10Tgt, i5Tgt, rzRec, rzReTd, i10ReTd, i5ReTd,
// rzAtt, i5Att, rzPaTd]; team rows: [week, rzCar, i10Car, i5Car, rzTgt, i10Tgt, i5Tgt].
const FIELDS = {
  player: ['week','team','rzCar','i10Car','i5Car','rzRuTd','i10RuTd','i5RuTd','rzTgt','i10Tgt','i5Tgt','rzRec','rzReTd','i10ReTd','i5ReTd','rzAtt','i5Att','rzPaTd'],
  team: ['week','rzCar','i10Car','i5Car','rzTgt','i10Tgt','i5Tgt'],
};
const W = (week: number, team: string) => [week, team, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const opts = { scoring: 'ppr', throughWeek: 18 };
const close = (a: number | null, b: number) => { expect(a).not.toBeNull(); expect(a as number).toBeCloseTo(b, 6); };
function attach(players: Record<string, unknown>[], teams: Record<string, number[][]>, rows: Record<string, (number | string)[][]>) {
  return M.attachRedzone(players, { schema: 1, fields: FIELDS, teams, players: rows });
}

describe('red zone: RB traded mid-season with a bye', () => {
  // AAA weeks 1-2, bye week 3 (AAA played, he has no row), BBB week 4.
  const rb: Record<string, unknown> = { id: 'RB1', pos: 'RB', w: [W(1,'AAA'), W(2,'AAA'), W(4,'BBB')] };
  attach([rb], {
    AAA: [[1,8,4,2,6,3,1],[2,5,2,1,4,2,0],[3,9,5,3,7,4,2]],
    BBB: [[4,6,3,2,5,2,2]],
  }, { RB1: [
    [1,'AAA',4,2,1,1,1,1,1,0,0,1,0,0,0,0,0,0],
    // week 2: no row although the team row exists -> real zero
    [4,'BBB',2,2,2,0,0,0,2,1,1,2,1,1,1,0,0,0],
  ] });
  it('counts carries, targets and zones', () => {
    expect(M.compute('rzCar', rb, opts)).toBe(6);
    expect(M.compute('i10Car', rb, opts)).toBe(4);
    expect(M.compute('i5Car', rb, opts)).toBe(3);
    expect(M.compute('rzTgt', rb, opts)).toBe(3);
    expect(M.compute('i5Tgt', rb, opts)).toBe(1);
    expect(M.compute('rzOpp', rb, opts)).toBe(9);
    expect(M.compute('i10Opp', rb, opts)).toBe(5);
    expect(M.compute('i5Opp', rb, opts)).toBe(4);
    expect(M.compute('rzTd', rb, opts)).toBe(2);
  });
  it('season shares sum each week\'s own team, skip the bye and are not averaged', () => {
    // 6 / (8+5+6). Including AAA week 3 would give 6/28; BBB only 2/6.
    close(M.compute('rzCarShare', rb, opts), 6 / 19);
    close(M.compute('glCarShare', rb, opts), 3 / 5);
    // (6+3) / ((8+5+6) + (6+4+5))
    close(M.compute('rzOppShare', rb, opts), 9 / 34);
    // (3+1) / ((2+1+2) + (1+0+2))
    close(M.compute('glOppShare', rb, opts), 4 / 8);
  });
  it('conversion, per-game and small-sample flags', () => {
    close(M.compute('rzRuTdRate', rb, opts), 1 / 6);
    close(M.compute('rzTgtTdRate', rb, opts), 1 / 3);
    close(M.compute('rzTdPerOpp', rb, opts), 2 / 9);
    close(M.compute('i5TdRate', rb, opts), 2 / 4);
    close(M.compute('rzOppPg', rb, opts), 9 / 3);
    expect(M.sampleSize('i5TdRate', rb, opts)).toBe(4);
    expect(M.isQualified('i5TdRate', rb, opts)).toBe(false);
    expect(M.isQualified('rzCar', rb, opts)).toBe(true);
  });
  it('a game with no red-zone row is zero, but its conversion is unavailable', () => {
    const row = W(2,'AAA');
    expect(M.compute('rzCar', rb, { ...opts, row })).toBe(0);
    expect(M.compute('rzCarShare', rb, { ...opts, row })).toBe(0);
    const r = M.evaluate('rzRuTdRate', rb, { ...opts, row });
    expect(r.value).toBeNull();
    expect(r.missing).toBe('No red-zone carries');
  });
  it('last-3 window uses recorded games only', () => {
    // all three rows: 9 opportunities / 3 games
    close(M.rzWindow(rb, 'rzOppPg', 3, opts), 3);
    expect(M.rzWindow(rb, 'rzOppPg', 5, opts)).toBeNull();
  });
});

describe('red zone: denominators and missing data', () => {
  it('zero team denominator gives no share, not 0%', () => {
    const p: Record<string, unknown> = { id: 'WR1', pos: 'WR', w: [W(1,'AAA')] };
    attach([p], { AAA: [[1,0,0,0,0,0,0]] }, {});
    expect(M.compute('rzTgt', p, opts)).toBe(0);
    const r = M.evaluate('rzTgtShare', p, opts);
    expect(r.value).toBeNull();
    expect(r.missing).toBe('No team red-zone targets');
  });
  it('a week without a team row makes counts unavailable instead of zero', () => {
    const p: Record<string, unknown> = { id: 'WR2', pos: 'WR', w: [W(1,'AAA'), W(2,'AAA')] };
    attach([p], { AAA: [[1,3,2,1,4,2,1]] }, { WR2: [[1,'AAA',0,0,0,0,0,0,2,1,0,1,1,1,0,0,0,0]] });
    expect(M.evaluate('rzTgt', p, opts).value).toBeNull();
    expect(M.compute('rzTgt', p, { ...opts, row: W(1,'AAA') })).toBe(2);
  });
  it('unloaded, unavailable and failed datasets explain themselves', () => {
    const p = { id: 'X', pos: 'RB', w: [W(1,'AAA')] };
    expect(M.evaluate('rzCar', p, opts).missing).toBe('Red-zone data loading');
    expect(M.evaluate('rzCar', p, { ...opts, rzStatus: 'unavailable' }).missing).toBe('Red-zone data not available for this season');
    expect(M.evaluate('rzCar', p, { ...opts, rzStatus: 'error' }).missing).toBe('Red-zone data failed to load');
  });
  it('kickers and defenses are not attached and not applicable', () => {
    const k: Record<string, unknown> = { id: 'K1', pos: 'K', w: [W(1,'AAA')] };
    expect(attach([k], { AAA: [[1,3,2,1,4,2,1]] }, {})).toBe(0);
    expect(k.rz).toBeUndefined();
    expect(M.evaluate('rzOpp', k, opts).missing).toBe('Not applicable for K');
    expect(M.tableColumns('K', 'season', 'redzone')).not.toContain('rzOpp');
  });
});

describe('red zone: quarterbacks and comparisons', () => {
  it('QB passing is separate from QB rushing opportunity', () => {
    const qb: Record<string, unknown> = { id: 'QB1', pos: 'QB', w: [W(1,'AAA')] };
    attach([qb], { AAA: [[1,6,3,1,8,4,2]] }, { QB1: [[1,'AAA',2,1,1,1,1,1,0,0,0,0,0,0,0,9,3,4]] });
    expect(M.compute('rzAtt', qb, opts)).toBe(9);
    close(M.compute('rzPaTdRate', qb, opts), 4 / 9);
    // Passing TDs are not QB opportunities or QB red-zone TDs.
    expect(M.compute('rzOpp', qb, opts)).toBe(2);
    expect(M.compute('rzTd', qb, opts)).toBe(1);
    close(M.compute('rzCarShare', qb, opts), 2 / 6);
    expect(M.evaluate('rzTgtShare', qb, opts).missing).toBe('Not applicable for QB');
  });
  it('comparison plans only include rows valid for both positions', () => {
    const rbWr = M.comparisonPlan('RB', 'WR');
    expect(rbWr.redzone).toContain('rzOppPg');
    expect(rbWr.redzone).toContain('glOppShare');
    expect(rbWr.redzone).not.toContain('rzPaTdRate');
    // QB vs WR is not a related position group: only fantasy scoring is compared.
    expect(M.comparisonPlan('QB', 'WR').redzone).toEqual([]);
    expect(M.comparisonPlan('K', 'RB').redzone).toEqual([]);
    expect(M.comparisonPlan('RB', 'RB').redzoneTotals).toEqual(['rzOpp', 'i5Opp', 'rzTd']);
  });
});

describe('red zone: generated files', () => {
  const dir = path.join(process.cwd(), 'public/research/data/redzone');
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'seasons.json'), 'utf8'));
  it('manifest lists the base seasons', () => {
    expect(manifest.schema).toBe(1);
    expect(manifest.years).toEqual(expect.arrayContaining([2023, 2024, 2025, 2026]));
  });
  it.each(manifest.years as number[])('%i: player totals never exceed team totals and throughWeek matches base', (year) => {
    const rz = JSON.parse(fs.readFileSync(path.join(dir, `${year}.json`), 'utf8'));
    const base = JSON.parse(fs.readFileSync(path.join(process.cwd(), `public/research/data/${year}.json`), 'utf8'));
    expect(rz.throughWeek).toBe(base.throughWeek);
    const sums: Record<string, number[]> = {};
    for (const rows of Object.values(rz.players) as (number | string)[][][]) {
      for (const r of rows) {
        const s = (sums[`${r[1]}:${r[0]}`] ||= [0, 0, 0, 0, 0, 0]);
        [2, 3, 4, 8, 9, 10].forEach((i, k) => { s[k] += r[i] as number; });
        expect(r[0] as number).toBeLessThanOrEqual(rz.throughWeek);
      }
    }
    for (const [key, s] of Object.entries(sums)) {
      const [team, week] = key.split(':');
      const t = (rz.teams[team] as number[][]).find(x => x[0] === Number(week))!;
      s.forEach((v, k) => expect(v).toBeLessThanOrEqual(t[k + 1]));
    }
  });
});

const python = (() => { for (const cmd of ['python', 'python3']) { try { execFileSync(cmd, ['--version']); return cmd; } catch { /* next */ } } return null; })();
describe.skipIf(!python)('red zone: play-by-play eligibility fixtures (Python builder)', () => {
  it('nullified penalties, scrambles, two-point tries, kneels, sacks and outside TDs follow the documented rules', () => {
    // unittest exits non-zero (and execFileSync throws) if any fixture fails.
    execFileSync(python as string, ['scripts/test-research-redzone.py'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  });
});
