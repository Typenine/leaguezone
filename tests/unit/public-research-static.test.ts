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
      expect(historical.source).toContain("nflverse/");
      expect(historical.schema).toBe(3);
      expect(historical.players.filter((p: {pos:string}) => p.pos === "DEF").length).toBe(32);
      expect(historical.players.filter((p: {pos:string}) => p.pos === "K").length).toBeGreaterThan(25);
      expect(historical.players.some((p: {ryr: number | null}) => p.ryr === year)).toBe(true);
      for(const player of historical.players) {
        expect(player.g).toBe(player.w.length);
        expect(new Set(player.w.map((w: number[]) => w[0])).size).toBe(player.w.length);
      }
    }
    const manifest=JSON.parse(read('public/research/data/seasons.json'));
    expect(manifest.years).toEqual([2023,2024,2025,2026]);
    expect(data.throughWeek).toBeGreaterThan(0);
    expect(data.players.length).toBeGreaterThan(100);
    expect(data.players.some((p: { pos: string }) => p.pos === 'K')).toBe(true);
    expect(data.players.filter((p: { pos: string }) => p.pos === "DEF").length).toBe(32);
    const chase2025=JSON.parse(read("public/research/data/2025.json")).players.find((p:{n:string})=>p.n==="Ja\'Marr Chase");
    expect(chase2025.w.map((w:number[])=>w[0])).toEqual(expect.arrayContaining([1,2,3,4]));
    const adams2024=JSON.parse(read("public/research/data/2024.json")).players.find((p:{n:string})=>p.n==="Davante Adams");
    expect(adams2024.w.some((w:number[])=>w[0]===1)).toBe(true);
  });
  it('is served via static rewrites, not Next dynamic page rendering', () => {
    const config = read('next.config.ts');
    expect(config).toContain("source: '/research'");
    expect(config).toContain("destination: '/research/index.html'");
    expect(read('public/research/index.html')).toContain('/research/app.js');
  });
  it('client application cannot call authenticated or database APIs', () => {
    const ui = read('public/research/app.js');
    expect(ui).toContain("var localUrl='/research/data/'+year+'.json'");
    expect(ui).toContain('fetch(localUrl');
    expect(ui).toContain('loadAvailableSeasons()');
    expect(ui).toContain("fetch('/research/data/seasons.json'");
    expect(ui).not.toMatch(/fetch\s*\(\s*['"\`]\/api\//);
    expect(ui).not.toMatch(/fetch\s*\(\s*['"\`]\/l\//);
    expect(ui).not.toMatch(/DATABASE_URL|@neondatabase|sql\`|\/api\/players/);
  });
  it('keeps the advanced column runtime initialized while using the R2 base loader', () => {
    const ui = read('public/research/app.js');
    // An earlier merge replaced the block between loadData and ensureUsage,
    // leaving the new column selector uninitialized in production.
    expect(ui).toContain('function columns(pos)');
    expect(ui).toContain('return M.tableColumns(pos');
    expect(ui).toContain('var M = window.LZResearchMetrics');
    expect(ui).toContain("var RZ_VIEWS = ['redzone','goalline']");
    expect(ui).toContain('state.rz = new Map()');
    expect(ui).toContain('function opts(row)');
    expect(ui).toContain('function loadAvailableSeasons()');
    expect(ui).toContain("var localUrl='/research/data/'+year+'.json'");
  });
  it('R2 publisher is isolated, versioned, and never commits weekly stats to Git', () => {
    const publisher = read('scripts/publish-public-research-r2.py');
    const workflow = read('.github/workflows/refresh-public-research.yml');
    const config = JSON.parse(read('public/research/data-source.json'));
    expect(publisher).toContain('CATALOG_KEY');
    expect(publisher).toContain('max-age=60');
    expect(publisher).toContain('immutable');
    expect(publisher).not.toMatch(/DATABASE_URL|@neondatabase|SLEEPER_API_KEY/);
    expect(workflow).toContain('python scripts/publish-public-research-r2.py');
    expect(workflow).not.toContain('git push');
    expect(workflow).not.toContain('git commit');
    expect(config.publicBase).toBe('https://leaguezone-research-data.patrickmmcnulty62.workers.dev');
    expect(read('public/research/app.js')).toContain('Last validated backup');
    expect(read('public/research/app.js')).toContain('R2 live data');
  });
  it('does not keep production R2 credentials hardcoded in the environment helper', () => {
    const setup = read('scripts/set-r2-envs.mjs');
    expect(setup).toContain('process.env');
    expect(setup).not.toMatch(/R2_SECRET_ACCESS_KEY:\s*['\"][A-Za-z0-9/+]{20,}['\"]/);
  });
  it('data pipeline is not allowed to import LeagueZone server code', () => {
    const updater = read('scripts/build-nflverse-research.py');
    expect(updater).toContain('nfl.load_player_stats');
    expect(updater).toContain('nfl.load_team_stats');
    expect(updater).toContain('nfl.load_players');
    expect(updater).toContain('seasons.json');
    expect(updater).not.toMatch(/DATABASE_URL|@neondatabase|from ['"]@\/lib|from ['"]@\/server/);
    expect(updater).not.toContain('NityaGehlot');
  });
});
