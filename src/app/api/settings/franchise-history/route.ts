import { NextRequest, NextResponse } from 'next/server';
import { getFantasyRosters } from '@/lib/server/fantasy-data';
import { listLeagueFranchiseIdentities, mergeLeagueFranchises, syncProviderIdentities } from '@/lib/server/provider-identities';
import { listLeagueProviderSeasons } from '@/lib/server/provider-seasons';
import { requireActiveLeagueMembership, requireLeagueCommissioner } from '@/lib/server/membership';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function synchronize(leagueId: string) {
  const seasons = await listLeagueProviderSeasons(leagueId);
  for (const season of seasons) {
    const rosters = await getFantasyRosters(leagueId, season.season).catch(() => null);
    if (rosters) await syncProviderIdentities(season, rosters.teams, rosters.players).catch(() => null);
  }
}

export async function GET(request: NextRequest) {
  const leagueId = request.nextUrl.searchParams.get('leagueId') || undefined;
  let membership;
  try { membership = await requireActiveLeagueMembership(leagueId); }
  catch (error) { return error as Response; }
  await synchronize(membership.leagueId);
  const rows = await listLeagueFranchiseIdentities(membership.leagueId);
  return NextResponse.json({ rows, isCommissioner: membership.isCommissioner });
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const leagueId = typeof body.leagueId === 'string' ? body.leagueId : undefined;
  let membership;
  try { membership = await requireLeagueCommissioner(leagueId); }
  catch (error) { return error as Response; }
  const sourceFranchiseId = typeof body.sourceFranchiseId === 'string' ? body.sourceFranchiseId : '';
  const targetFranchiseId = typeof body.targetFranchiseId === 'string' ? body.targetFranchiseId : '';
  try {
    await mergeLeagueFranchises(membership.leagueId, sourceFranchiseId, targetFranchiseId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to merge franchise history.' }, { status: 400 });
  }
}
