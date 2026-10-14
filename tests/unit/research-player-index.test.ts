import { describe, expect, it } from 'vitest';
import { loadPlayerIndex } from '@/lib/research-player-index';

const KEY = 'research/v1/objects/2026-' + 'a'.repeat(64) + '.json';
const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, n: 'Player ' + i, pos: 'WR', team: 'SEA', w: [[1]] }));
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
function fake(routes: Record<string, () => Response>) {
  const calls: string[] = [];
  return { calls, f: async (url: string) => { calls.push(url); const r = routes[url]; return r ? r() : new Response('', { status: 404 }); } };
}
const base = 'https://data.example.com';
const local = {
  '/research/data/seasons.json': () => ok({ years: [2024, 2025] }),
  '/research/data/2025.json': () => ok({ year: 2025, throughWeek: 18, players: players(120) })
};

describe('global search player index', () => {
  it('uses the newest validated R2 season and keeps only search fields', async () => {
    const { f, calls } = fake({ ...local, '/research/data-source.json': () => ok({ publicBase: base }),
      [base + '/research/v1/catalog.json']: () => ok({ schema: 1, years: [2025, 2026], files: { 2026: { key: KEY } } }),
      [base + '/' + KEY]: () => ok({ year: 2026, throughWeek: 4, players: players(150) }) });
    const d = await loadPlayerIndex(f);
    expect(d).toMatchObject({ year: 2026, throughWeek: 4, source: 'live' });
    expect(d.players[0]).toEqual({ id: 'p0', n: 'Player 0', pos: 'WR', team: 'SEA' });
    expect(calls).not.toContain('/research/data/2025.json');
  });
  it('falls back to the bundled backup when R2 is down', async () => {
    const { f } = fake({ ...local, '/research/data-source.json': () => ok({ publicBase: base }) });
    expect(await loadPlayerIndex(f)).toMatchObject({ year: 2025, source: 'backup' });
  });
  it('rejects an incomplete or mismatched R2 season', async () => {
    const { f } = fake({ ...local, '/research/data-source.json': () => ok({ publicBase: base }),
      [base + '/research/v1/catalog.json']: () => ok({ schema: 1, years: [2026], files: { 2026: { key: KEY } } }),
      [base + '/' + KEY]: () => ok({ year: 2025, players: players(150) }) });
    expect((await loadPlayerIndex(f)).source).toBe('backup');
  });
  it('rejects catalog keys outside the immutable object path', async () => {
    const { f, calls } = fake({ ...local, '/research/data-source.json': () => ok({ publicBase: base }),
      [base + '/research/v1/catalog.json']: () => ok({ schema: 1, years: [2026], files: { 2026: { key: '../2026.json' } } }) });
    expect((await loadPlayerIndex(f)).source).toBe('backup');
    expect(calls.some(c => c.includes('../'))).toBe(false);
  });
});
