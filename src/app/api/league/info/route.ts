import { NextRequest, NextResponse } from 'next/server';
import { getCurrentLeague } from '@/lib/server/league-context';
import { guardPublicDataRequest } from '@/lib/server/public-api-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const guarded = await guardPublicDataRequest(req, {
    action: 'league-info',
    requireBrowserGate: true,
    limit: { maxRequests: 60, windowSeconds: 5 * 60 },
  });
  if (guarded) return guarded;

  const league = await getCurrentLeague();
  if (!league) {
    return NextResponse.json({ name: null, shortName: null, logoUrl: null, foundedYear: null });
  }

  return NextResponse.json({
    name: league.name,
    shortName: league.shortName,
    logoUrl: league.logoUrl,
    foundedYear: league.foundedYear,
  }, {
    headers: {
      'X-LeagueZone-Data-Mode': league._reliability?.stale ? 'stale' : 'live',
      ...(league._reliability?.stale && league._reliability.cachedAt
        ? { 'X-LeagueZone-Cached-At': new Date(league._reliability.cachedAt).toISOString() }
        : {}),
    },
  });
}
