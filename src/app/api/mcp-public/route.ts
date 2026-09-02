import { NextRequest } from 'next/server';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { getPlayerProfile } from '@/lib/players/player-profile-service';
import { getLeague as getSleeperLeague, getLeagueMatchups, getRosterIdToTeamNameMap, getTeamsData, type SleeperMatchup } from '@/lib/utils/sleeper-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const tools = [
  { name: 'get_league_history', description: 'Return every configured season, final standings, and weekly matchup scores for a LeagueZone league.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'get_league_records', description: 'Calculate the highest team scores and franchise regular-season records across the configured league history.', inputSchema: { type: 'object', properties: { limit: { type: 'number', minimum: 1, maximum: 50 } }, additionalProperties: false } },
  { name: 'get_player_history', description: 'Return a player profile and franchise-attributed history within this LeagueZone league.', inputSchema: { type: 'object', properties: { playerId: { type: 'string' } }, required: ['playerId'], additionalProperties: false } },
] as const;

const responseHeaders = { 'cache-control': 'no-store, max-age=0' };
function rpc(id: unknown, result: unknown, status = 200) { return Response.json({ jsonrpc: '2.0', id: id ?? null, result }, { status, headers: responseHeaders }); }
function error(id: unknown, code: number, message: string, status = 400) { return Response.json({ jsonrpc: '2.0', id: id ?? null, error: { code, message } }, { status, headers: responseHeaders }); }

function validateToolArguments(name: string, args: unknown): Record<string, unknown> {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Tool arguments must be an object');
  const values = args as Record<string, unknown>;
  if (name === 'get_league_history') {
    if (Object.keys(values).length) throw new Error('get_league_history does not accept arguments');
    return values;
  }
  if (name === 'get_league_records') {
    if (values.limit != null && (!Number.isFinite(Number(values.limit)) || Number(values.limit) < 1 || Number(values.limit) > 50)) throw new Error('limit must be between 1 and 50');
    return values;
  }
  if (name === 'get_player_history') {
    if (typeof values.playerId !== 'string' || !values.playerId.trim()) throw new Error('playerId is required');
    return values;
  }
  throw new Error(`Unknown tool: ${name}`);
}

async function context(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('league')?.trim().toLowerCase();
  if (!slug) return null;
  const league = await getLeagueBySlug(slug);
  if (!league?.sleeperLeagueId) return null;
  const sleeper = await getSleeperLeague(league.sleeperLeagueId).catch(() => null);
  const currentSeason = String(sleeper?.season || new Date().getUTCFullYear());
  const seasons = { ...league.sleeperLeagueIds, [currentSeason]: league.sleeperLeagueId };
  return { league, currentSeason, seasons };
}

async function leagueHistory(ctx: NonNullable<Awaited<ReturnType<typeof context>>>) {
  const output = [];
  for (const [season, sleeperLeagueId] of Object.entries(ctx.seasons).sort(([a], [b]) => a.localeCompare(b))) {
    const [league, teams, names] = await Promise.all([getSleeperLeague(sleeperLeagueId).catch(() => null), getTeamsData(sleeperLeagueId).catch(() => []), getRosterIdToTeamNameMap(sleeperLeagueId).catch(() => new Map<number, string>())]);
    const settings = (league?.settings || {}) as { playoff_week_start?: number; playoff_start_week?: number };
    const lastWeek = Math.min(18, Math.max(17, Number(settings.playoff_week_start ?? settings.playoff_start_week ?? 15) + 2));
    const weeks = await Promise.all(Array.from({ length: lastWeek }, (_, index) => getLeagueMatchups(sleeperLeagueId, index + 1).catch(() => [] as SleeperMatchup[])));
    output.push({ season, sleeperLeagueId, standings: teams.map((team) => ({ team: team.teamName, wins: team.wins, losses: team.losses, ties: team.ties, pointsFor: team.fpts, pointsAgainst: team.fptsAgainst })), weeks: weeks.map((rows, index) => ({ week: index + 1, teams: rows.map((row) => ({ rosterId: row.roster_id, team: names.get(row.roster_id) || `Roster ${row.roster_id}`, matchupId: row.matchup_id, points: Number(row.custom_points ?? row.points ?? 0) })) })) });
  }
  return { league: { id: ctx.league.id, slug: ctx.league.slug, name: ctx.league.name, foundedYear: ctx.league.foundedYear }, seasons: output };
}

async function callTool(name: string, args: Record<string, unknown>, ctx: NonNullable<Awaited<ReturnType<typeof context>>>) {
  if (name === 'get_league_history') return leagueHistory(ctx);
  if (name === 'get_league_records') {
    const history = await leagueHistory(ctx); const limit = Math.max(1, Math.min(50, Number(args.limit || 10))); const scores: Array<{ season: string; week: number; team: string; points: number }> = [];
    history.seasons.forEach((season) => season.weeks.forEach((week) => week.teams.forEach((team) => { if (team.points > 0) scores.push({ season: season.season, week: week.week, team: team.team, points: team.points }); })));
    const franchise = new Map<string, { wins: number; losses: number; ties: number; pointsFor: number }>();
    history.seasons.forEach((season) => season.standings.forEach((team) => { const row = franchise.get(team.team) || { wins: 0, losses: 0, ties: 0, pointsFor: 0 }; row.wins += team.wins; row.losses += team.losses; row.ties += team.ties; row.pointsFor += team.pointsFor; franchise.set(team.team, row); }));
    return { highestScores: scores.sort((a, b) => b.points - a.points).slice(0, limit), franchiseRecords: [...franchise.entries()].map(([team, record]) => ({ team, ...record })).sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor) };
  }
  if (name === 'get_player_history') {
    const playerId = String(args.playerId || ''); if (!playerId) throw new Error('playerId is required');
    const previousLeagueIds = Object.fromEntries(Object.entries(ctx.seasons).filter(([season]) => season !== ctx.currentSeason));
    return getPlayerProfile(playerId, { currentSeason: ctx.currentSeason, currentLeagueId: ctx.league.sleeperLeagueId!, previousLeagueIds, cacheKey: ctx.league.id });
  }
  throw new Error(`Unknown tool: ${name}`);
}

export async function GET(request: NextRequest) {
  const ctx = await context(request);
  if (!ctx) return Response.json({ name: 'LeagueZone Public History Connector', error: 'Add ?league=<league-slug> for a connected public league.' }, { status: 400, headers: responseHeaders });
  return Response.json({ name: `${ctx.league.name} LeagueZone Connector`, protocolVersion: '2025-06-18', endpoint: request.nextUrl.toString(), tools: tools.map((tool) => tool.name) }, { headers: responseHeaders });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { id?: unknown; method?: string; params?: { name?: string; arguments?: Record<string, unknown> } } | null;
  if (!body) return error(null, -32700, 'Invalid JSON');
  const ctx = await context(request); if (!ctx) return error(body.id, -32602, 'A valid league query parameter is required', 404);
  if (body.method === 'initialize') return rpc(body.id, { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: `${ctx.league.name} LeagueZone`, version: '1.0.0' } });
  if (body.method === 'notifications/initialized') return new Response(null, { status: 202, headers: responseHeaders });
  if (body.method === 'ping') return rpc(body.id, {});
  if (body.method === 'tools/list') return rpc(body.id, { tools });
  if (body.method === 'tools/call') {
    try { const name = String(body.params?.name || ''); const args = validateToolArguments(name, body.params?.arguments || {}); const data = await callTool(name, args, ctx); return rpc(body.id, { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data }); }
    catch (cause) { return error(body.id, -32602, cause instanceof Error ? cause.message : 'Tool call failed'); }
  }
  return error(body.id, -32601, 'Method not found');
}
