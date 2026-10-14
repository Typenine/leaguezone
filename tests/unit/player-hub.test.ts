import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const req = createRequire(path.resolve('package.json'));
const H = req('./public/research/hub.js');
type Row = (string | number)[];
type P = { id: string; n: string; pos: string; team: string; g: number; p: number; rec: number; tgt?: number; ryr?: number | null; w: Row[]; u?: unknown[] };
// Week row: [week, team, ppr points, rec, tgt, recYds, car, rushYds, ...]
const row = (week: number, team: string, pts: number, rec: number, tgt: number): Row => [week, team, pts, rec, tgt, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const wr = (id: string, p: number, rec: number, g: number, extra: Partial<P> = {}): P =>
  ({ id, n: id, pos: 'WR', team: 'AAA', g, p, rec, w: [], ...extra });

describe('positional context', () => {
  it('requires half the weeks played so far before ranking', () => {
    expect(H.minGames(18)).toBe(9);
    expect(H.minGames(5)).toBe(3);
    expect(H.minGames(0)).toBe(1);
  });
  // Hand calculated: half PPR = (PPR points - 0.5 * receptions) / games.
  // A: (50-5)/4 = 11.25, B: (70-20)/5 = 10, C has 1 game (< 3 needed), RB excluded.
  const players = [wr('A', 50, 10, 4), wr('B', 70, 40, 5), wr('C', 30, 0, 1), { ...wr('R', 100, 0, 5), pos: 'RB' }];
  const half = { scoring: 'half', throughWeek: 5, year: 2025 };
  it('ranks only qualified players at the same position', () => {
    const a = H.positionalRank(players, players[0], 'ppg', half);
    expect(a).toMatchObject({ rank: 1, population: 2, percentile: 100, minGames: 3, partial: true });
    expect(a.value).toBeCloseTo(11.25);
    expect(H.positionalRank(players, players[1], 'ppg', half)).toMatchObject({ rank: 2, percentile: 0 });
  });
  it('does not present an unqualified rank', () => {
    const c = H.positionalRank(players, players[2], 'ppg', half);
    expect(c.rank).toBeNull();
    expect(c.value).toBe(30);
    expect(c.reason).toBe('Needs 3+ games with stats');
  });
  it('respects the scoring format', () => {
    // Full PPR: A 50/4 = 12.5, B 70/5 = 14, so B moves ahead.
    const ppr = { ...half, scoring: 'ppr' };
    expect(H.positionalRank(players, players[1], 'ppg', ppr).rank).toBe(1);
    expect(H.positionalRank(players, players[0], 'ppg', ppr).rank).toBe(2);
  });
  it('never ranks a statistic that does not apply to the position', () => {
    expect(H.positionalRank(players, players[0], 'carShare', half)?.rank ?? null).toBeNull();
    expect(H.positionalRank(players, { ...players[0], pos: 'K' }, 'tgtPg', half)).toBeNull();
  });
  it('matches an independent ranking of published 2025 WR points per game', () => {
    const d = JSON.parse(readFileSync('public/research/data/2025.json', 'utf8')) as { throughWeek: number; players: P[] };
    const pool = d.players.filter(p => p.pos === 'WR' && p.g >= Math.ceil(d.throughWeek / 2))
      .map(p => ({ id: p.id, v: (p.p - 0.5 * p.rec) / p.g })).sort((a, b) => b.v - a.v);
    const target = d.players.find(p => p.id === pool[4].id)!;
    const r = H.positionalRank(d.players, target, 'ppg', { scoring: 'half', throughWeek: d.throughWeek, year: 2025 });
    expect(r.population).toBe(pool.length);
    expect(r.rank).toBe(pool.filter(x => x.v > pool[4].v + 1e-9).length + 1);
  });
});

describe('weekly chart series', () => {
  const traded = wr('T', 40, 8, 4, { team: 'PIT', w: [row(1, 'NYJ', 10, 2, 5), row(2, 'NYJ', 8, 2, 4), row(4, 'PIT', 12, 2, 6), row(5, 'PIT', 10, 2, 7)] });
  it('marks byes and missed weeks as no game rather than zero', () => {
    const s = H.weeklySeries(traded, 'targets', { scoring: 'half' }, 6);
    expect(s.map((x: { value: number | null }) => x.value)).toEqual([5, 4, null, 6, 7, null]);
    expect(s[2].status).toBe('no-game');
    expect(s[5].status).toBe('no-game');
  });
  it('keeps the team the player had in each week', () => {
    const s = H.weeklySeries(traded, 'points', { scoring: 'half' }, 5);
    expect(s.map((x: { team: string | null }) => x.team)).toEqual(['NYJ', 'NYJ', null, 'PIT', 'PIT']);
    expect(s[0].value).toBeCloseTo(9); // 10 PPR - 0.5 * 2 receptions
  });
  it('separates unavailable advanced usage from a real game', () => {
    const s = H.weeklySeries(traded, 'tgtShare', { scoring: 'half' }, 2);
    expect(s[0].status).toBe('not-recorded');
    expect(s[0].value).toBeNull();
  });
  it('only offers chart metrics that apply to the position', () => {
    expect(H.chartKeys('K')).toEqual(['points', 'fgm', 'xpm']);
    expect(H.chartKeys('DEF')).toContain('pa');
    expect(H.chartKeys('QB')).not.toContain('targets');
    expect(H.weeklySeries(traded, 'passing', {}, 5)).toBeNull();
  });
});

describe('career progression', () => {
  const season = (g: number, p: number, rec: number, w: Row[] = []) => wr('X', p, rec, g, { w });
  it('reports year-over-year changes only between consecutive seasons', () => {
    const c = H.careerRows([
      { year: 2025, throughWeek: 18, player: season(16, 200, 40) }, // (200-20)/16 = 11.25
      { year: 2023, throughWeek: 18, player: season(10, 100, 0) }, // 10
      { year: 2026, throughWeek: 4, player: season(4, 60, 8) } // (60-4)/4 = 14
    ], [], 'half');
    expect(c.rows.map((r: { year: number }) => r.year)).toEqual([2023, 2025, 2026]);
    expect(c.rows[1].change.ppg).toBeNull(); // 2024 missing
    expect(c.rows[2].change.ppg).toBeCloseTo(2.75);
    expect(c.rows[2].partial).toBe(true);
    expect(c.high.year).toBe(2026);
    expect(c.low.year).toBe(2023);
  });
  it('lists every team from a season with a trade, in week order', () => {
    const c = H.careerRows([{ year: 2024, throughWeek: 18, player: season(2, 20, 2, [row(9, 'PIT', 10, 1, 3), row(2, 'NYJ', 10, 1, 3)]) }], [], 'half');
    expect(c.rows[0].teams).toEqual(['NYJ', 'PIT']);
    expect(c.high).toBeNull(); // one season is not a career high
  });
  it('skips seasons before a verified rookie year without hard-coding years', () => {
    expect(H.candidateSeasons([2023, 2024, 2025, 2026], { ryr: 2025 })).toEqual([2025, 2026]);
    expect(H.candidateSeasons([2023, 2024], { ryr: null })).toEqual([2023, 2024]);
  });
  it('labels current, in-progress and historical seasons', () => {
    expect(H.seasonStatus(2026, 2026, 4).label).toBe('Current season \u00b7 Through Week 4');
    expect(H.seasonStatus(2024, 2026, 18).label).toBe('Historical season \u00b7 Final');
  });
});
