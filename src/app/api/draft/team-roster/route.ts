import { NextRequest } from 'next/server';
import { getLeagueRosters, getRosterIdToTeamNameMap, getAllPlayersCached, type SleeperPlayer } from '@/lib/utils/sleeper-api';
import { getLeagueIdsFromDb } from '@/lib/server/league-config';
import { getCurrentLeague } from '@/lib/server/league-context';
import { canonicalizeTeamName } from '@/lib/server/user-identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const POS_ORDER: Record<string, number> = { QB: 0, RB: 1, WR: 2, TE: 3, K: 4, DEF: 5 };

export async function GET(req: NextRequest) {
  const team = new URL(req.url).searchParams.get('team') || '';
  if (!team) return Response.json({ error: 'team required' }, { status: 400 });

  try {
    const league = await getCurrentLeague();
    if (!league) return Response.json({ players: [] });
    const { current: sleeperLeagueId } = await getLeagueIdsFromDb(league.id);
    if (!sleeperLeagueId) return Response.json({ players: [] });

    const [rosters, nameMap, allPlayers] = await Promise.all([
      getLeagueRosters(sleeperLeagueId).catch(() => []),
      getRosterIdToTeamNameMap(sleeperLeagueId).catch(() => new Map<number, string>()),
      getAllPlayersCached().catch(() => ({} as Record<string, SleeperPlayer>)),
    ]);
    const canon = canonicalizeTeamName(team);
    const roster = rosters.find((r) => canonicalizeTeamName(nameMap.get(r.roster_id) || '') === canon);
    if (!roster) return Response.json({ players: [] });
    const playerIds: string[] = Array.isArray(roster.players) ? (roster.players as string[]).filter(Boolean) : [];
    const players = playerIds
      .map((id) => {
        const p = allPlayers[id];
        const name = p ? [p.first_name, p.last_name].filter(Boolean).join(' ') || id : id;
        return { id, name, pos: p?.position || '', nfl: p?.team || '' };
      })
      .sort((a, b) => (POS_ORDER[a.pos] ?? 9) - (POS_ORDER[b.pos] ?? 9) || a.name.localeCompare(b.name));
    return Response.json({ players });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
