import { NextRequest, NextResponse } from 'next/server';
import { resolveActiveFantasyLeagueId } from '@/lib/server/fantasy-request';
import { getFantasyRosters } from '@/lib/server/fantasy-data';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const leagueId = await resolveActiveFantasyLeagueId();
  if (!leagueId) return NextResponse.json({ error: 'No active league selected.' }, { status: 404 });
  const season = request.nextUrl.searchParams.get('season');
  try {
    return NextResponse.json(await getFantasyRosters(leagueId, season));
  } catch (error) {
    console.error('[fantasy/rosters]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Rosters are not available for that season.' }, { status: 502 });
  }
}
