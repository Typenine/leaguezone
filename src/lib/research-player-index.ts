export type IndexPlayer = { id: string; n: string; pos: string; team: string };
export type PlayerIndex = { players: IndexPlayer[]; year: number; throughWeek: number | null; source: 'live' | 'backup' };
type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
const OBJECT_KEY = /^research\/v1\/objects\/20\d\d-[a-f0-9]{64}\.json$/;

async function json(f: Fetch, url: string, init: RequestInit) {
  const r = await f(url, init);
  if (!r.ok) throw Error('Research unavailable (' + r.status + ')');
  return r.json();
}
// Same acceptance rule as the research app: right season, a full player list.
function season(d: unknown, year: number): PlayerIndex {
  const data = d as { year?: number; throughWeek?: number; players?: unknown };
  if (!data || data.year !== year || !Array.isArray(data.players) || data.players.length < 100) throw Error('Incomplete season ' + year);
  const players = (data.players as IndexPlayer[]).filter(p => p && typeof p.id === 'string' && typeof p.n === 'string')
    .map(p => ({ id: p.id, n: p.n, pos: String(p.pos || ''), team: String(p.team || '') }));
  return { players, year, throughWeek: Number.isInteger(data.throughWeek) ? Number(data.throughWeek) : null, source: 'backup' };
}
function latest(years: unknown): number {
  const list = Array.isArray(years) ? years.filter(Number.isInteger) as number[] : [];
  if (!list.length) throw Error('No seasons available');
  return Math.max(...list);
}
// Latest validated R2 season (the same immutable object the research app
// reads, so it is usually already cached), else the bundled static backup.
export async function loadPlayerIndex(f: Fetch = (u, i) => fetch(u, i)): Promise<PlayerIndex> {
  try {
    const config = await json(f, '/research/data-source.json', { cache: 'no-store' });
    const base = String(config?.publicBase || '').replace(/\/+$/, '');
    if (!/^https:\/\/[^/]+$/i.test(base) || /\.r2\.dev$/i.test(new URL(base).hostname)) throw Error('No public research source');
    const catalog = await json(f, base + '/research/v1/catalog.json', { cache: 'no-cache' });
    if (catalog?.schema !== 1 || !catalog.files) throw Error('Invalid research catalog');
    const year = latest(catalog.years), info = catalog.files[String(year)];
    if (!info || !OBJECT_KEY.test(String(info.key))) throw Error('Invalid research catalog');
    return { ...season(await json(f, base + '/' + info.key, { cache: 'default' }), year), source: 'live' };
  } catch {
    const manifest = await json(f, '/research/data/seasons.json', { cache: 'no-cache' });
    const year = latest(manifest?.years);
    return season(await json(f, '/research/data/' + year + '.json', { cache: 'default' }), year);
  }
}
