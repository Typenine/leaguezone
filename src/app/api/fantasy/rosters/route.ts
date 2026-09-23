import { NextRequest, NextResponse } from 'next/server';
import { resolveActiveFantasyLeagueId } from '@/lib/server/fantasy-request';
import { getFantasyRostersResult } from '@/lib/server/fantasy-data';
import { reliabilityResponseHeaders } from '@/lib/server/reliability-cache';
import { guardPublicDataRequest } from '@/lib/server/public-api-guard';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const guarded = await guardPublicDataRequest(request, {
    action: 'fantasy-rosters',
    requireBrowserGate: true,
    limit: { maxRequests: 60, windowSeconds: 5 * 60 },
  });
  if (guarded) return guarded;

  const leagueId = await resolveActiveFantasyLeagueId();
  if (!leagueId) return NextResponse.json({ error: 'No active league selected.' }, { status: 404 });
  const season = request.nextUrl.searchParams.get('season');
  try {
    const result = await getFantasyRostersResult(leagueId, season);
    return NextResponse.json(result.value, { headers: reliabilityResponseHeaders(result) });
  } catch (error) {
    console.error('[fantasy/rosters]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Rosters are not available for that season.' }, { status: 502 });
  }
}
