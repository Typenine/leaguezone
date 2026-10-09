/**
 * Generate read-only public research data without importing any LeagueZone server code.
 * Uses public weekly NFL stat exports; does not connect to Neon or any fantasy league.
 * Run with: node scripts/refresh-public-research.mjs
 */
import { writeFile, mkdir, readFile } from 'node:fs/promises';

const season = Number(process.env.RESEARCH_SEASON || new Date().getUTCFullYear());
const outputPath = 'public/research/data/' + season + '.json';
const urlFor = (week) =>
  'https://raw.githubusercontent.com/NityaGehlot/nfl-data/main/data/Stats/' +
  season + '%20Season/' + season + '%20Offense/player_stats_' +
  season + '_week' + String(week).padStart(2, '0') + '.json';

const players = new Map();
let lastWeek = 0;
for (let week = 1; week <= 18; week++) {
  let res;
  for (let attempt = 0; attempt < 2; attempt++) {
    try { res = await fetch(urlFor(week), { signal: AbortSignal.timeout(20000) }); break; }
    catch (error) { if (attempt === 1) throw error; }
  }
  if (res.status === 404) break;
  if (!res.ok) throw new Error('Public NFL data request failed: HTTP ' + res.status + ' week ' + week);
  const body = await res.json();
  const rows = Object.values(body).flat();
  if (!Array.isArray(rows) || rows.length < 20) throw new Error('Unexpected data shape in week ' + week);
  const actual = new Map();
  for (const row of rows.filter(p => p.position === 'QB' && p.game_played && p.attempts >= 10 && p.team && p.opponent_team)) {
    const prior = actual.get(row.team);
    if (!prior || Number(row.attempts) > Number(prior.attempts)) actual.set(row.team, row);
  }
  let played = 0;
  for (const r of rows) {
    if (!r || !r.game_played || !['QB','RB','WR','TE','K'].includes(r.position) || !r.player_id || !r.player_name) continue;
    if (actual.has(r.team) && actual.get(r.team).opponent_team !== r.opponent_team) continue;
    const id = String(r.player_id);
    if (!players.has(id)) players.set(id, { id, n:r.player_name, pos:r.position, team:r.team,
      g:0, p:0, rec:0, tgt:0, ry:0, rt:0, car:0, ruy:0, rut:0, snap:0, w:[] });
    const p = players.get(id);
    const v = (field) => Number(r[field]) || 0;
    const fp = v('fantasy_points_ppr');
    p.team = r.team;
    p.g++;
    p.p += fp;
    p.rec += v('receptions');
    p.tgt += v('targets');
    p.ry += v('receiving_yards');
    p.rt += v('receiving_tds');
    p.car += v('carries');
    p.ruy += v('rushing_yards');
    p.rut += v('rushing_tds');
    p.snap += v('snap_count');
    p.w.push([week,r.team,Number(fp.toFixed(2)),v('receptions'),v('targets'),v('receiving_yards'),v('carries'),v('rushing_yards')]);
    played++;
  }
  if (played === 0) break; // Do not advance to an unplayed / future week.
  lastWeek = week;
  process.stdout.write('Week ' + week + ': ' + played + ' player records\n');
}
if (lastWeek === 0 || players.size < 100) throw new Error('Insufficient data; preserving existing public snapshot.');
const list = [...players.values()].map(p => ({ ...p, p:Number(p.p.toFixed(2)) })).sort((a,b) => b.p - a.p);
const output = { year:season, throughWeek:lastWeek, updated:new Date().toISOString().slice(0,10),
  source:'NityaGehlot/nfl-data weekly offensive player records', schema:1, players:list };
const previous = await readFile(outputPath, 'utf8').then(JSON.parse).catch(() => null);
if (previous && previous.year === output.year && previous.throughWeek > output.throughWeek)
  throw new Error('New data covers fewer weeks than the current snapshot; refusing regression.');
await mkdir('public/research/data', { recursive:true });
await writeFile(outputPath, JSON.stringify(output) + '\n');
console.log('Wrote ' + outputPath + ': ' + list.length + ' players through Week ' + lastWeek);
