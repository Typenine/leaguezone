import { NextRequest, NextResponse } from 'next/server';
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
    return NextResponse.json({ ...rosters.value, catalog }, {
      headers: reliabilityResponseHeaders(rosters),
    });
  } catch (error) {
    console.error('[league-opportunities]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'League rosters are temporarily unavailable.' }, { status: 502 });
  }
}
