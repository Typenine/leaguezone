import { type NextRequest } from 'next/server';
import { getPlayerProfile, type PlayerProfileLeagueContext } from '@/lib/players/player-profile-service';
import { getCurrentLeague, getLeagueBySlug, type League } from '@/lib/server/league-context';
import { getLeague as getSleeperLeague } from '@/lib/utils/sleeper-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function buildPlayerContext(league: League): Promise<PlayerProfileLeagueContext | null> {
  const configuredIds = league.sleeperLeagueIds || {};
  const currentLeagueId = league.sleeperLeagueId
    || Object.entries(configuredIds).sort(([a], [b]) => a.localeCompare(b)).at(-1)?.[1]
    || null;
  if (!currentLeagueId) return null;

  const sleeper = await getSleeperLeague(currentLeagueId).catch(() => null);
  const configuredCurrentSeason = Object.entries(configuredIds).find(([, id]) => id === currentLeagueId)?.[0];
  const currentSeason = String(
    sleeper?.season
      || configuredCurrentSeason
      || Object.keys(configuredIds).sort().at(-1)
      || new Date().getUTCFullYear(),
  );
  const previousLeagueIds = Object.fromEntries(
    Object.entries(configuredIds).filter(([season, id]) => season !== currentSeason && id !== currentLeagueId),
  );

  return {
    currentSeason,
    currentLeagueId,
    previousLeagueIds,
    cacheKey: league.id,
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  const requestedLeagueSlug = req.nextUrl.searchParams.get('league')?.trim().toLowerCase() || '';

  try {
    const league = requestedLeagueSlug
      ? await getLeagueBySlug(requestedLeagueSlug)
      : await getCurrentLeague();

    if (requestedLeagueSlug && !league) {
      return Response.json({ error: 'League not found' }, { status: 404 });
    }

    const context = league ? await buildPlayerContext(league) : null;
    if (requestedLeagueSlug && !context) {
      return Response.json({ error: 'League player data unavailable' }, { status: 404 });
    }

    const profile = await getPlayerProfile(playerId, context || undefined);
    if (!profile) return Response.json({ error: 'Player not found' }, { status: 404 });
    return Response.json(profile);
  } catch {
    return Response.json({ error: 'Failed to load player profile' }, { status: 500 });
  }
}
