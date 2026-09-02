import { requireActiveLeagueMembership, type ActiveLeagueMembership } from '@/lib/server/membership';
import { getTradeBlockLeagueById, listTradeBlockTeams } from '@/lib/server/trade-block-store';
import {
  loadTradeBlockLeagueContext,
  teamAssetsFromContext,
  TradeBlockProviderError,
} from '@/lib/server/trade-block-provider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  let membership: ActiveLeagueMembership;
  try {
    membership = await requireActiveLeagueMembership();
  } catch (error) {
    return error as Response;
  }

  if (!membership.teamName) {
    return Response.json({ error: 'A team membership is required.' }, { status: 403 });
  }

  const league = await getTradeBlockLeagueById(membership.leagueId);
  if (!league) return Response.json({ error: 'League not found.' }, { status: 404 });

  try {
    const teams = await listTradeBlockTeams(league.id);
    const ctx = await loadTradeBlockLeagueContext(league, teams);
    const assets = teamAssetsFromContext(membership.teamName, membership.rosterId, ctx);
    const years = Array.from(new Set(assets.picks.map((pick) => pick.year))).sort((a, b) => a - b);
    const year = years[0] ?? Number(ctx.providerLeague.season);
    return Response.json({ ...assets, year, years });
  } catch (error) {
    if (error instanceof TradeBlockProviderError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('[me/assets] Failed to load scoped assets', error);
    return Response.json({ error: 'Failed to load team assets.' }, { status: 500 });
  }
}
