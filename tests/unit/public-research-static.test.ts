import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('public research database isolation', () => {
  const read = (path: string) => readFileSync(path, 'utf8');
  it('has a static dataset with real season metadata', () => {
    const data = JSON.parse(read('public/research/data/2026.json'));
    expect(data.year).toBe(2026);
    const known = [
      [2023, 'CeeDee Lamb', 403.2],
      [2024, 'Ja\'Marr Chase', 403],
      [2025, 'Christian McCaffrey', 416.6],
    ] as const;
    for (const [year, name, expected] of known) {
      const data = JSON.parse(read('public/research/data/' + year + '.json'));
      const player = data.players.find((p: { n: string }) => p.n === name);
      expect(player, year + ' ' + name).toBeDefined();
      expect(player.p).toBeCloseTo(expected, 1);
    }
    for(const year of [2023,2024,2025]) {
      const historical=JSON.parse(read('public/research/data/'+year+'.json'));
      expect(historical.year).toBe(year);
      expect(historical.throughWeek).toBe(18);
      expect(historical.players.length).toBeGreaterThan(500);
      for(const player of historical.players) {
        expect(player.g).toBe(player.w.length);
        expect(new Set(player.w.map((w: number[]) => w[0])).size).toBe(player.w.length);
      }
    }
    expect(data.throughWeek).toBeGreaterThan(0);
    expect(data.players.length).toBeGreaterThan(100);
    expect(data.players.some((p: { pos: string }) => p.pos === 'K')).toBe(true);
  });
  it('is served via static rewrites, not Next dynamic page rendering', () => {
    const config = read('next.config.ts');
    expect(config).toContain("source: '/research'");
    expect(config).toContain("destination: '/research/index.html'");
    expect(read('public/research/index.html')).toContain('/research/app.js');
  });
  it('client application cannot call authenticated or database APIs', () => {
    const ui = read('public/research/app.js');
    expect(ui).toContain("fetch('/research/data/'+year+'.json'");
    expect(ui).not.toMatch(/fetch\s*\(\s*['"\`]\/api\//);
    expect(ui).not.toMatch(/fetch\s*\(\s*['"\`]\/l\//);
    expect(ui).not.toMatch(/DATABASE_URL|@neondatabase|sql\`|\/api\/players/);
  });
  it('data pipeline is not allowed to import LeagueZone server code', () => {
    const updater = read('scripts/refresh-public-research.mjs');
    expect(updater).not.toMatch(/DATABASE_URL|@neondatabase|from ['"]@\/lib|from ['"]@\/server/);
  });
});
