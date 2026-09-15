import { NextRequest, NextResponse } from 'next/server';
import { resolveActiveFantasyLeagueId } from '@/lib/server/fantasy-request';
import { getFantasyStandings } from '@/lib/server/fantasy-data';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const leagueId = await resolveActiveFantasyLeagueId();
  if (!leagueId) return NextResponse.json({ error: 'No active league selected.' }, { status: 404 });
  const season = request.nextUrl.searchParams.get('season');
  try {
    return NextResponse.json(await getFantasyStandings(leagueId, season));
  } catch (error) {
    console.error('[fantasy/standings]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Standings are not available for that season.' }, { status: 502 });
  }
}
