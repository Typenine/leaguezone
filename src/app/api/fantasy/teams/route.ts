import { NextResponse } from 'next/server';
import { resolveActiveFantasyLeagueId } from '@/lib/server/fantasy-request';
import { getFantasyTeamDirectory } from '@/lib/server/fantasy-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const leagueId = await resolveActiveFantasyLeagueId();
  if (!leagueId) return NextResponse.json({ error: 'No active league selected.' }, { status: 404 });
  try {
    return NextResponse.json(await getFantasyTeamDirectory(leagueId));
  } catch (error) {
    console.error('[fantasy/teams]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Teams are not available for this league.' }, { status: 502 });
  }
}
