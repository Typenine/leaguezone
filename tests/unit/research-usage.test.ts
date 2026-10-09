import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const M = require('../../public/research/metrics.js');

// Expected values below are worked out by hand from the raw fixture numbers,
// not by calling the helper.
const BASE = (week: number, team: string, car: number, tgt: number, rec = 0) =>
  [week, team, 10, rec, tgt, 0, car, 0, 0, 0, 0, 0, 0, 0, 0];
const opts = { scoring: 'ppr', throughWeek: 18 };
const close = (a: number | null, b: number) => { expect(a).not.toBeNull(); expect(a as number).toBeCloseTo(b, 6); };

function attach(player: Record<string, unknown>, usage: Record<string, unknown>) {
  M.attachUsage([player], { schema: 1, ...usage });
  return player;
}

describe('advanced usage: traded WR with a bye and a zero-target week', () => {
  // AAA weeks 1-2, bye week 3/4 (no row), BBB weeks 5-6.
  const wr = attach({ id: 'WR1', pos: 'WR', w: [BASE(1,'AAA',1,8,6), BASE(2,'AAA',0,10,7), BASE(5,'BBB',0,9,5), BASE(6,'BBB',2,0,0)] }, {
    teams: { AAA: [[1,30,25,32,300],[2,35,20,40,280],[4,28,30,30,250]], BBB: [[5,40,22,36,360],[6,30,26,30,200]] },
    players: { WR1: [[1,'AAA',0,0,0,1,8,6,100,40],[2,'AAA',0,0,0,0,10,7,120,30],[5,'BBB',0,0,0,0,9,5,90,25],[6,'BBB',0,0,0,2,0,0,0,0]] }
  });
  it('season target share is weighted by each week\'s own team, not averaged and not final-team only', () => {
    // 27 targets / (32+40+36+30=138). Averaging weekly shares would give 0.1875;
    // using BBB only would give 9/66.
    close(M.compute('tgtShare', wr, opts), 27 / 138);
  });
  it('air yards, air-yards share, aDOT, YAC and YAC/rec', () => {
    expect(M.compute('ay', wr, opts)).toBe(310);
    close(M.compute('ayShare', wr, opts), 310 / 1140);
    close(M.compute('adot', wr, opts), 310 / 27);
    expect(M.compute('yac', wr, opts)).toBe(95);
    close(M.compute('yacPerRec', wr, opts), 95 / 18);
  });
  it('carry share uses each week\'s team carries (25+20+22+26)', () => {
    close(M.compute('carShare', wr, opts), 3 / 93);
  });
  it('week values: zero targets is a real 0% share, aDOT is unavailable', () => {
    const row = BASE(6,'BBB',2,0,0);
    expect(M.compute('tgtShare', wr, { ...opts, row })).toBe(0);
    const adot = M.evaluate('adot', wr, { ...opts, row });
    expect(adot.value).toBeNull();
    expect(adot.missing).toBe('No targets recorded');
    close(M.compute('tgtShare', wr, { ...opts, row: BASE(1,'AAA',1,8,6) }), 8 / 32);
  });
  it('last-3 window uses recorded games 2, 5, 6 (bye skipped)', () => {
    close(M.usageWindow(wr, 'tgtShare', 3, opts), 19 / 106);
    expect(M.usageWindow(wr, 'tgtShare', 5, opts)).toBeNull();
    expect(M.opportunityTrend(wr, opts)).toBeNull(); // needs 5+ games
  });
});

describe('advanced usage: QB passing', () => {
  const qb = attach({ id: 'QB1', pos: 'QB', w: [BASE(1,'AAA',4,0), BASE(2,'AAA',2,0), BASE(3,'AAA',1,0)] }, {
    teams: { AAA: [[1,30,25,32,300],[2,40,20,40,280],[3,1,30,0,0]] },
    players: { QB1: [[1,'AAA',30,20,250,4,0,0,0,0],[2,'AAA',40,26,300,2,0,0,0,0],[3,'AAA',0,0,0,1,0,0,0,0]] }
  });
  it('completion %, Y/A and per-game volume', () => {
    expect(M.compute('att', qb, opts)).toBe(70);
    expect(M.compute('cmp', qb, opts)).toBe(46);
    close(M.compute('cmpPct', qb, opts), 46 / 70);
    close(M.compute('ypa', qb, opts), 550 / 70);
    close(M.compute('attPg', qb, opts), 70 / 3);
    close(M.compute('cmpPg', qb, opts), 46 / 3);
    close(M.compute('carShare', qb, opts), 7 / 75);
    expect(M.format('cmpPct', 46 / 70)).toBe('65.7%');
  });
  it('zero attempts gives unavailable rates, not 0%', () => {
    const r = M.evaluate('cmpPct', qb, { ...opts, row: BASE(3,'AAA',1,0) });
    expect(r.value).toBeNull();
    expect(r.missing).toBe('No pass attempts recorded');
    close(M.compute('ypa', qb, { ...opts, row: BASE(1,'AAA',4,0) }), 250 / 30);
  });
  it('qualifier: 14 attempts per team week for season rates, 10 for a single week', () => {
    expect(M.isQualified('cmpPct', qb, { ...opts, throughWeek: 5 })).toBe(true);   // 70 >= 70
    expect(M.isQualified('cmpPct', qb, { ...opts, throughWeek: 6 })).toBe(false);  // 70 < 84
    expect(M.isQualified('cmpPct', qb, { ...opts, row: BASE(1,'AAA',4,0) })).toBe(true);
  });
  it('passing stats do not apply to receivers', () => {
    expect(M.evaluate('att', { id: 'x', pos: 'WR', u: [] }, opts).missing).toBe('Not applicable for WR');
  });
});

describe('advanced usage: missing data and denominators', () => {
  it('a null source field makes the total unavailable instead of zero', () => {
    const p = attach({ id: 'P', pos: 'WR', w: [] }, { teams: { T: [[1,30,20,30,200],[2,30,20,30,200]] },
      players: { P: [[1,'T',0,0,0,0,5,3,50,10],[2,'T',0,0,0,0,5,3,null,10]] } });
    expect(M.compute('ay', p, opts)).toBeNull();
    expect(M.compute('ayShare', p, opts)).toBeNull();
    close(M.compute('tgtShare', p, opts), 10 / 60);
  });
  it('zero team denominator gives an unavailable share', () => {
    const p = attach({ id: 'P', pos: 'RB', w: [] }, { teams: { T: [[1,0,0,0,0]] }, players: { P: [[1,'T',0,0,0,0,0,0,0,0]] } });
    expect(M.evaluate('tgtShare', p, opts)).toEqual({ value: null, missing: 'No team targets recorded' });
    expect(M.evaluate('carShare', p, opts).value).toBeNull();
  });
  it('missing team-week denominator is unavailable, never 0', () => {
    const p = attach({ id: 'P', pos: 'WR', w: [] }, { teams: {}, players: { P: [[1,'T',0,0,0,0,5,3,50,10]] } });
    expect(M.compute('tgtShare', p, opts)).toBeNull();
  });
  it('explains not-loaded, unavailable and failed usage data', () => {
    const p = { id: 'P', pos: 'WR', w: [] };
    expect(M.evaluate('tgtShare', p, opts).missing).toBe('Advanced usage loading');
    expect(M.evaluate('tgtShare', p, { ...opts, usageStatus: 'unavailable' }).missing).toBe('Advanced usage not available for this season');
    expect(M.evaluate('tgtShare', p, { ...opts, usageStatus: 'error' }).missing).toBe('Advanced usage failed to load');
  });
});

describe('advanced usage: opportunity trend', () => {
  const weeks = [1,2,3,5,6,7], cars = [10,10,10,15,15,20];
  const rb = attach({ id: 'RB1', pos: 'RB', w: weeks.map((wk, i) => BASE(wk,'T',cars[i],2)) }, {
    teams: { T: [1,2,3,4,5,6,7].map(wk => [wk,30,25,30,200]) },
    players: { RB1: weeks.map((wk, i) => [wk,'T',0,0,0,cars[i],2,1,5,8]) }
  });
  it('last 3 recorded games vs earlier games, absolute change in points', () => {
    const t = M.opportunityTrend(rb, opts);
    expect(t.recentWeeks).toEqual([5,6,7]);
    expect(t.priorWeeks).toEqual([1,2,3]);
    const by = Object.fromEntries(t.metrics.map((m: { key: string }) => [m.key, m]));
    close(by.carShare.recent, 50 / 75);
    close(by.carShare.prior, 30 / 75);
    close(by.carShare.change, 50 / 75 - 30 / 75);
    expect(M.formatDiff('carShare', by.carShare.change)).toBe('+26.7 pts');
    close(by.carPg.change, 50 / 3 - 10);
    expect(M.formatDiff('tgtShare', by.tgtShare.change)).toBe('Even');
  });
});

describe('advanced usage: comparisons', () => {
  it('compares only shared, rate-based usage stats', () => {
    expect(M.comparisonPlan('WR','RB').usage).toEqual(['tgtShare','ayShare','adot','yacPerRec','carShare']);
    expect(M.comparisonPlan('K','WR').usage).toEqual([]);
    expect(M.comparisonPlan('QB','QB').usage).toEqual(['attPg','cmpPg','cmpPct','ypa','carShare']);
  });
});

describe('advanced usage: published datasets reconcile', () => {
  const dir = path.join(__dirname, '../../public/research/data');
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'usage/seasons.json'), 'utf8'));
  it.each(manifest.years as number[])('%i usage file matches its base season', (year) => {
    const base = JSON.parse(fs.readFileSync(path.join(dir, `${year}.json`), 'utf8'));
    const usage = JSON.parse(fs.readFileSync(path.join(dir, `usage/${year}.json`), 'utf8'));
    expect(usage.schema).toBe(1);
    expect(usage.throughWeek).toBe(base.throughWeek);
    const team = new Map<string, number[]>();
    for (const [t, rows] of Object.entries(usage.teams as Record<string, number[][]>)) rows.forEach(r => team.set(`${t}:${r[0]}`, r));
    const sums = new Map<string, number>();
    for (const p of base.players.filter((x: { pos: string }) => ['QB','RB','WR','TE'].includes(x.pos))) {
      const rows = usage.players[p.id];
      expect(rows?.length, p.id).toBe(p.w.length);
      for (const r of rows) {
        const b = p.w.find((w: unknown[]) => w[0] === r[0]);
        expect([r[1], r[5], r[6], r[7]]).toEqual([b[1], b[6], b[4], b[3]]); // team, carries, targets, receptions
        expect(r[0]).toBeLessThanOrEqual(usage.throughWeek);
        expect(team.has(`${r[1]}:${r[0]}`)).toBe(true);
        sums.set(`${r[1]}:${r[0]}`, (sums.get(`${r[1]}:${r[0]}`) || 0) + r[6]);
      }
    }
    for (const [k, tgt] of sums) expect(tgt).toBeLessThanOrEqual(team.get(k)![3]);
  });
  it('real 2025 traded WRs: helper share equals independent sum over each week\'s team denominator', () => {
    const base = JSON.parse(fs.readFileSync(path.join(dir, '2025.json'), 'utf8'));
    const usage = JSON.parse(fs.readFileSync(path.join(dir, 'usage/2025.json'), 'utf8'));
    const traded = base.players.filter((p: { pos: string; w: unknown[][] }) => p.pos === 'WR' && new Set(p.w.map(w => w[1])).size > 1);
    expect(traded.length).toBeGreaterThan(0);
    M.attachUsage(base.players, usage);
    for (const p of traded) {
      let tgt = 0, den = 0;
      for (const r of usage.players[p.id]) { tgt += r[6]; den += usage.teams[r[1]].find((t: number[]) => t[0] === r[0])[3]; }
      close(M.compute('tgtShare', p, opts), tgt / den);
    }
  });
});
