import { NextResponse } from 'next/server';
import { resolveActiveFantasyLeagueId } from '@/lib/server/fantasy-request';
import { listLeagueProviderSeasons } from '@/lib/server/provider-seasons';

export const dynamic = 'force-dynamic';

export async function GET() {
  const leagueId = await resolveActiveFantasyLeagueId();
  if (!leagueId) return NextResponse.json({ error: 'No active league selected.' }, { status: 404 });
  const seasons = await listLeagueProviderSeasons(leagueId);
  const current = seasons.find((item) => item.isCurrent) || seasons[0] || null;
  return NextResponse.json({
    currentSeason: current ? String(current.season) : '',
    provider: current?.provider || null,
    seasons: seasons.map((item) => ({ season: String(item.season), provider: item.provider })),
  });
}
