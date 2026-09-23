import { NextRequest, NextResponse } from 'next/server';
import { resolveActiveFantasyLeagueId } from '@/lib/server/fantasy-request';
import { listLeagueProviderSeasonsResult } from '@/lib/server/provider-seasons';
import { reliabilityResponseHeaders } from '@/lib/server/reliability-cache';
import { guardPublicDataRequest } from '@/lib/server/public-api-guard';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const guarded = await guardPublicDataRequest(request, {
    action: 'fantasy-seasons',
    requireBrowserGate: true,
    limit: { maxRequests: 60, windowSeconds: 5 * 60 },
  });
  if (guarded) return guarded;

  const leagueId = await resolveActiveFantasyLeagueId();
  if (!leagueId) return NextResponse.json({ error: 'No active league selected.' }, { status: 404 });

  try {
    const result = await listLeagueProviderSeasonsResult(leagueId);
    const rows = result.value;
    const current = rows.find((item) => item.isCurrent) || rows[0] || null;
    return NextResponse.json({
      currentSeason: current ? String(current.season) : '',
      provider: current?.provider || null,
      seasons: rows.map((item) => ({ season: String(item.season), provider: item.provider })),
    }, { headers: reliabilityResponseHeaders(result) });
  } catch (error) {
    console.error('[fantasy/seasons]', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'League seasons are temporarily unavailable.' },
      { status: 503, headers: { 'Retry-After': '60' } },
    );
  }
}
