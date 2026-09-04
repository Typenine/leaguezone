import { getCurrentLeague } from '@/lib/server/league-context';
import { listLeagueDrafts } from '@/server/db/draft-scope-queries';
import { getDraftOverview } from '@/server/db/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type HistoryPick = {
  pick_no: number;
  round: number;
  pick: number;
  team: string;
  player: string;
  playerId?: string;
  pos?: string;
};

export async function GET() {
  const league = await getCurrentLeague();
  if (!league) return Response.json({ years: [], drafts: {} });

  const summaries = (await listLeagueDrafts(league.id, false))
    .filter((draft) => draft.environment === 'live' && draft.status === 'COMPLETED');

  const latestByYear = new Map<number, typeof summaries[number]>();
  for (const draft of summaries) {
    if (!latestByYear.has(draft.year)) latestByYear.set(draft.year, draft);
  }

  const drafts: Record<string, unknown> = {};
  for (const draft of latestByYear.values()) {
    const overview = await getDraftOverview(draft.id).catch(() => null);
    if (!overview) continue;

    const slots = (overview.allSlots || []).slice().sort((a, b) => a.overall - b.overall);
    const picks = (overview.allPicks || overview.recentPicks || []).slice().sort((a, b) => a.overall - b.overall);
    const picksPerRound = slots.filter((slot) => slot.round === 1).length
      || Math.max(0, ...picks.filter((pick) => pick.round === 1).map((pick) => pick.pickInRound || 0));
    const teamNames = Array.from(new Set(slots.map((slot) => slot.team).filter(Boolean)));

    const linearPicks: HistoryPick[] = picks.map((pick) => ({
      pick_no: pick.overall,
      round: pick.round,
      pick: pick.pickInRound || (picksPerRound > 0 ? ((pick.overall - 1) % picksPerRound) + 1 : pick.overall),
      team: pick.team,
      player: pick.playerName || pick.playerId || 'Unknown selection',
      ...(pick.playerId ? { playerId: pick.playerId } : {}),
      ...(pick.playerPos ? { pos: pick.playerPos } : {}),
    }));

    const teamHauls = teamNames.map((team) => ({
      team,
      picks: linearPicks
        .filter((pick) => pick.team === team)
        .map((pick) => ({
          round: pick.round,
          pick: pick.pick,
          player: pick.player,
          ...(pick.playerId ? { playerId: pick.playerId } : {}),
        })),
    }));

    drafts[String(draft.year)] = {
      rounds: overview.rounds,
      picks_per_round: picksPerRound,
      team_hauls: teamHauls,
      isAuction: false,
      linear_picks: linearPicks,
      source: 'leaguezone',
      archivedAt: draft.archivedAt,
      completedAt: draft.completedAt,
    };
  }

  const years = Object.keys(drafts).sort((a, b) => Number(b) - Number(a));
  return Response.json({ years, drafts });
}
