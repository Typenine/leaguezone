import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/server/auth';
import { getUserLeagues } from '@/lib/server/user-auth';
import { getFantasyLeagueSettings } from '@/lib/server/provider-settings';
import { getCurrentLeagueBySlug } from '@/lib/server/league-context';
import { getFantasyRostersResult } from '@/lib/server/fantasy-data';
import { guardPublicDataRequest } from '@/lib/server/public-api-guard';
import { getAllPlayersCached } from '@/lib/utils/sleeper-api';
import { reliabilityResponseHeaders } from '@/lib/server/reliability-cache';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const guarded = await guardPublicDataRequest(request, {
    action: 'league-opportunities', requireBrowserGate: true,
    limit: { maxRequests: 30, windowSeconds: 5 * 60 },
  });
  if (guarded) return guarded;
  const { slug } = await params;
  const league = await getCurrentLeagueBySlug(slug);
  if (!league) return NextResponse.json({ error: 'League not found.' }, { status: 404 });
  // A browser-gate cookie is NOT league authorization. Restrict provider
  // rosters, owner associations and the complete player identity catalog to
  // actual league members; never expose another league's rosters by slug.
  const claims = verifySession(request.cookies.get('evw_session')?.value || '');
  if (!claims || claims.type !== 'user' || typeof claims.sub !== 'string') {
    return NextResponse.json({ error: 'Sign in to view roster opportunities.' }, { status: 401 });
  }
  const membership = (await getUserLeagues(claims.sub)).find((item) => item.leagueId === league.id);
  if (!membership) {
    return NextResponse.json({ error: 'You are not a member of this league.' }, { status: 403 });
  }
  try {
    const rosters = await getFantasyRostersResult(league.id);
    // The provider catalog is cached independently of this request. Only a
    // slim identity index is sent; no league history or private DB data.
    const all = rosters.value.provider === 'sleeper'
      ? await getAllPlayersCached().catch(() => null) : null;
    const catalog = all ? Object.entries(all).filter(([, p]) =>
      ['QB', 'RB', 'WR', 'TE'].includes(p.position) && Boolean(p.team) && Boolean(p.first_name && p.last_name),
    ).map(([id, p]) => ({ id, gsisId: p.gsis_id || null,
      name: `${p.first_name} ${p.last_name}`, position: p.position, team: p.team })) : [];
    const settings = await getFantasyLeagueSettings(league.id).catch(() => null);
    return NextResponse.json({ ...rosters.value, catalog,
      viewerRosterId: membership.rosterId,
      leaguePpr: settings?.ppr ?? null,
    }, {
      headers: {...reliabilityResponseHeaders(rosters), 'Cache-Control': 'private, no-store'},
    });
  } catch (error) {
    console.error('[league-opportunities]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'League rosters are temporarily unavailable.' }, { status: 502 });
  }
}
