import { NextRequest } from 'next/server';
import { getCurrentLeagueId } from '@/lib/server/league-context';
import { getFantasyRosters } from '@/lib/server/fantasy-data';
import { getAllPlayersCached, type SleeperPlayer } from '@/lib/utils/sleeper-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const idsParam = url.searchParams.get('ids') || '';
    const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 250);
    if (ids.length === 0) return Response.json({ players: {} });

    const players: Record<string, { name: string; position?: string; team?: string }> = {};
    const leagueId = await getCurrentLeagueId();
    if (leagueId) {
      const rosterData = await getFantasyRosters(leagueId).catch(() => null);
      if (rosterData) {
        for (const id of ids) {
          const player = rosterData.players[id];
          if (player) players[id] = { name: player.fullName || id, position: player.position || undefined, team: player.nflTeam || undefined };
        }
      }
    }

    const unresolved = ids.filter((id) => !players[id]);
    if (unresolved.length) {
      const all: Record<string, SleeperPlayer> = await getAllPlayersCached()
        .catch(() => ({} as Record<string, SleeperPlayer>));
      for (const id of unresolved) {
        const player = all[id];
        if (player) {
          const name = [player.first_name, player.last_name].filter(Boolean).join(' ').trim() || id;
          players[id] = { name, position: player.position || undefined, team: player.team || undefined };
        } else {
          players[id] = { name: id };
        }
      }
    }
    return Response.json({ players });
  } catch {
    return Response.json({ error: 'Failed to resolve players' }, { status: 500 });
  }
}
