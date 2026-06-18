/**
 * GET /api/team-logos
 * Returns a public map of teamName → { logoUrl, helmetColorIndex } for the active league.
 * Used by TeamLogoProvider to hydrate client-side logo/helmet overrides.
 */
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const jar = await cookies();
    const activeLeagueId = jar.get('active_league_id')?.value;

    const db = getDb();
    const res = activeLeagueId
      ? await db.execute(sql`SELECT config FROM leagues WHERE setup_completed = true AND id = ${activeLeagueId}::uuid LIMIT 1`)
      : await db.execute(sql`SELECT config FROM leagues WHERE setup_completed = true ORDER BY created_at DESC LIMIT 1`);

    const rows = (res as { rows?: Array<Record<string, unknown>> }).rows;
    const row = rows?.[0];
    if (!row) return NextResponse.json({});

    const config = (row.config as Record<string, unknown>) ?? {};
    const teamLogos = (config.teamLogos as Record<string, string | null>) ?? {};
    const teamColors = (config.teamColors as Record<string, { helmetIndex?: number | null }>) ?? {};

    const result: Record<string, { logoUrl: string | null; helmetColorIndex: number | null }> = {};
    const allTeams = new Set([...Object.keys(teamLogos), ...Object.keys(teamColors)]);

    for (const team of allTeams) {
      result[team] = {
        logoUrl: teamLogos[team] ?? null,
        helmetColorIndex: teamColors[team]?.helmetIndex ?? null,
      };
    }

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
    });
  } catch {
    return NextResponse.json({});
  }
}
