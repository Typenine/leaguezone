import { requireActiveLeagueMembership } from '@/lib/server/membership';
import { getTradeBlockLeagueById, listTradeBlockTeams } from '@/lib/server/trade-block-store';
import { loadTradeBlockLeagueContext, teamAssetsFromContext, TradeBlockProviderError } from '@/lib/server/trade-block-provider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const membershipResult = await requireActiveLeagueMembership()
    .then((membership) => ({ ok: true as const, membership }))
    .catch((error) => ({ ok: false as const, error }));
  if (!membershipResult.ok) return membershipResult.error as Response;

  const membership = membershipResult.membership;
  if (!membership.teamName) return Response.json({ error: 'A team membership is required.' }, { status: 403 });
  const league = await getTradeBlockLeagueById(membership.leagueId);
  if (!league) return Response.json({ error: 'League not found.' }, { status: 404 });

  try {
    const teams = await listTradeBlockTeams(league.id);
    const ctx = await loadTradeBlockLeagueContext(league, teams);
    const assets = teamAssetsFromContext(membership.teamName, membership.rosterId, ctx);
    const years = Array.from(new Set(assets.picks.map((pick) => pick.year))).sort((a, b) => a - b);
    const year = years[0] ?? ctx.season;

    return Response.json({
      team: membership.teamName,
      rosterId: membership.rosterId,
      provider: ctx.provider,
      season: ctx.season,
      ...assets,
      year,
      years,
      supportsTradedPicks: ctx.provider === 'sleeper',
      supportsFaab: ctx.waiverBudget != null,
    });
  } catch (error) {
    if (error instanceof TradeBlockProviderError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('[me/assets] Failed to load team assets', error);
    return Response.json({ error: 'Failed to load team assets.' }, { status: 500 });
  }
}
