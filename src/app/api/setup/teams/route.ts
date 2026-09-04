import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { requireUser } from '@/lib/server/session';
import { requireSetupLeagueOwnership } from '@/lib/server/setup-ownership';
import { normalizeBrandPalette, type BrandPalette } from '@/lib/branding/colors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveSetupLeague(userId: string, bodyLeagueId?: string) {
  const jar = await cookies();
  const leagueId =
    (typeof bodyLeagueId === 'string' ? bodyLeagueId : null) ||
    jar.get('setup_league_id')?.value ||
    jar.get('active_league_id')?.value ||
    null;
  if (!leagueId) return null;

  const owned = await requireSetupLeagueOwnership(userId, leagueId);
  if (!owned) return null;

  const db = getDb();
  const rowRes = await db.execute(sql`
    SELECT id, config, team_colors
    FROM leagues
    WHERE id = ${leagueId}::uuid
    LIMIT 1
  `);
  const rows = (rowRes as { rows?: Array<Record<string, unknown>> }).rows ?? [];
  return rows[0] ? { leagueId, row: rows[0] } : null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireUser();
    if (!session) return NextResponse.json({ teams: [], teamColors: {} }, { status: 401 });

    const url = new URL(request.url);
    const qLeagueId = url.searchParams.get('leagueId') || undefined;
    const resolved = await resolveSetupLeague(session.userId, qLeagueId);
    if (!resolved) return NextResponse.json({ teams: [], teamColors: {} });

    const config = (resolved.row.config as Record<string, unknown>) || {};
    const teams = (config.teams as Array<{ rosterId: number; teamName: string; ownerName: string }>) || [];
    const teamColors = (resolved.row.team_colors as Record<string, BrandPalette> | null) || {};
    return NextResponse.json({ teams, teamColors });
  } catch (error) {
    console.error('[setup/teams GET] Error:', error);
    return NextResponse.json({ teams: [], teamColors: {} });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireUser();
    if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const body = await request.json();
    const bodyLeagueId = typeof body.leagueId === 'string' ? body.leagueId : undefined;
    const resolved = await resolveSetupLeague(session.userId, bodyLeagueId);
    if (!resolved) {
      return NextResponse.json(
        { error: 'No league found. Please start setup from the beginning.' },
        { status: 400 }
      );
    }

    if (!body.teamColors || typeof body.teamColors !== 'object' || Array.isArray(body.teamColors)) {
      return NextResponse.json({ error: 'Team colors must be an object.' }, { status: 400 });
    }

    const config = (resolved.row.config as Record<string, unknown>) || {};
    const teams = (config.teams as Array<{ teamName?: string }>) || [];
    const allowedTeams = new Set(teams.map((team) => team.teamName).filter((name): name is string => Boolean(name)));
    const normalizedTeamColors: Record<string, BrandPalette> = {};

    for (const [teamName, rawPalette] of Object.entries(body.teamColors as Record<string, unknown>)) {
      if (!allowedTeams.has(teamName)) {
        return NextResponse.json({ error: `Unknown team: ${teamName}` }, { status: 400 });
      }
      const palette = normalizeBrandPalette(rawPalette);
      if (!palette) {
        return NextResponse.json({ error: `Invalid colors for ${teamName}. Use hex colors such as #0b5f98.` }, { status: 400 });
      }
      normalizedTeamColors[teamName] = palette;
    }

    const db = getDb();
    await db.execute(sql`
      UPDATE leagues SET
        team_colors = ${JSON.stringify(normalizedTeamColors)}::jsonb,
        config = jsonb_set(
          COALESCE(config, '{}'),
          '{completedSetupSteps}',
          (
            SELECT CASE
              WHEN COALESCE(config->'completedSetupSteps', '[]'::jsonb) ? 'teams'
                THEN COALESCE(config->'completedSetupSteps', '[]'::jsonb)
              ELSE COALESCE(config->'completedSetupSteps', '[]'::jsonb) || '["teams"]'::jsonb
            END
            FROM leagues WHERE id = ${resolved.leagueId}::uuid
          )
        ),
        updated_at = now()
      WHERE id = ${resolved.leagueId}::uuid
    `);

    return NextResponse.json({ success: true, leagueId: resolved.leagueId });
  } catch (error) {
    console.error('[setup/teams POST] Error:', error);
    return NextResponse.json({ error: 'Failed to save team colors' }, { status: 500 });
  }
}
