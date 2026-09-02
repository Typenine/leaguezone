import { getLeagueBySlug } from '@/lib/server/league-config';
import { leagueSlugFromTradeBlockReferer } from '@/lib/server/trade-block-request';
import {
  listLeagueTradeBlocks,
  listTradeBlockTeams,
  type TradeBlockLeague,
} from '@/lib/server/trade-block-store';
import {
  loadTradeBlockLeagueContext,
  sanitizeTradeBlock,
  teamAssetsFromContext,
  TradeBlockProviderError,
} from '@/lib/server/trade-block-provider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const leagueSlug = leagueSlugFromTradeBlockReferer(req.headers.get('referer'));
  if (!leagueSlug) {
    return Response.json({ error: 'League context required.' }, { status: 400 });
  }

  const leagueRow = await getLeagueBySlug(leagueSlug);
  if (!leagueRow) return Response.json({ error: 'League not found.' }, { status: 404 });

  const league: TradeBlockLeague = {
    id: leagueRow.id,
    slug: leagueRow.slug,
    name: leagueRow.name,
    sleeperLeagueId: leagueRow.sleeperLeagueId,
  };

  try {
    const [rows, teams] = await Promise.all([
      listLeagueTradeBlocks(league.id),
      listTradeBlockTeams(league.id),
    ]);

    try {
      const ctx = await loadTradeBlockLeagueContext(league, teams);
      const validated = rows.map((row) => ({
        team: row.team,
        tradeBlock: sanitizeTradeBlock(
          row.tradeBlock,
          teamAssetsFromContext(row.team, row.rosterId, ctx),
        ),
        tradeWants: row.tradeWants,
        updatedAt: row.updatedAt,
      }));
      return Response.json({ teams: validated, providerAvailable: true });
    } catch (error) {
      if (error instanceof TradeBlockProviderError) {
        // Reading the league trade block should remain available when Sleeper is
        // temporarily unavailable. We simply cannot revalidate ownership until
        // the provider recovers.
        return Response.json({
          teams: rows.map(({ team, tradeBlock, tradeWants, updatedAt }) => ({ team, tradeBlock, tradeWants, updatedAt })),
          providerAvailable: false,
          providerWarning: error.message,
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('[teams/trade-blocks] Failed to load league trade blocks', { leagueId: league.id, error });
    return Response.json({ error: 'Failed to load trade blocks.' }, { status: 500 });
  }
}
