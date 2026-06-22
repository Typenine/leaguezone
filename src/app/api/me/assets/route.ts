import { requireTeamUser } from '@/lib/server/session';
import { getActiveLeagueMembership } from '@/lib/server/membership';
import { getTeamAssets } from '@/lib/server/trade-assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  // Try account session first, fall back to legacy PIN session
  const membership = await getActiveLeagueMembership();
  if (membership.ok) {
    const { teamName, leagueId, rosterId } = membership.membership;
    const assets = await getTeamAssets(teamName, leagueId, rosterId ?? undefined);
    const years = Array.from(new Set(assets.picks.map((p) => p.year))).sort((a, b) => a - b);
    const year = years.length > 0 ? years[0] : new Date().getFullYear() + 1;
    return Response.json({ ...assets, year, years });
  }

  const ident = await requireTeamUser();
  if (!ident) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const assets = await getTeamAssets(ident.team);
  const years = Array.from(new Set(assets.picks.map((p) => p.year))).sort((a, b) => a - b);
  const year = years.length > 0 ? years[0] : new Date().getFullYear() + 1;
  return Response.json({ ...assets, year, years });
}
