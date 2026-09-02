import { NextResponse } from 'next/server';
import { getActiveLeagueMembership } from '@/lib/server/membership';
import { buildTeamLineupOptimizerV3 } from '@/lib/fantasy/weekly-projections-next';
import type { LineupOptimizerResponse } from '@/lib/fantasy/lineup-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CACHE_TTL_MS = 10 * 60 * 1000;
const responseCache = new Map<string, { ts: number; data: LineupOptimizerResponse }>();

export async function GET() {
  const result = await getActiveLeagueMembership();
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  const membership = result.membership;
  if (!membership.teamName) return NextResponse.json({ error: 'No team is assigned' }, { status: 404 });

  const cacheKey = `${membership.leagueId}:${membership.teamName}`;
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json(cached.data, {
      headers: { 'Cache-Control': 'private, max-age=300' },
    });
  }

  try {
    const data = await buildTeamLineupOptimizerV3(membership.teamName, membership.leagueId);
    responseCache.set(cacheKey, { ts: Date.now(), data });
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'private, max-age=300' },
    });
  } catch (error) {
    console.error('[home-lineup-optimizer] failed', error);
    const message = error instanceof Error ? error.message : '';
    const status = message === 'Team roster not found' ? 404 : 500;
    return NextResponse.json(
      { error: status === 404 ? message : 'Unable to build lineup projections' },
      { status }
    );
  }
}
