import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { requireUser } from '@/lib/server/session';

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

  const db = getDb();
  const ownerCheck = await db.execute(sql`
    SELECT id, config FROM leagues
    WHERE id = ${leagueId}::uuid
      AND (commissioner_user_id = ${userId}::uuid OR commissioner_user_id IS NULL)
    LIMIT 1
  `);
  const rows = (ownerCheck as { rows?: Array<Record<string, unknown>> }).rows ?? [];
  return rows[0] ? { leagueId, row: rows[0] } : null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireUser();
    if (!session) return NextResponse.json({ teams: [] }, { status: 401 });

    const url = new URL(request.url);
    const qLeagueId = url.searchParams.get('leagueId') || undefined;
    const resolved = await resolveSetupLeague(session.userId, qLeagueId);
    if (!resolved) return NextResponse.json({ teams: [] });

    const config = (resolved.row.config as Record<string, unknown>) || {};
    const teams = (config.teams as Array<{ rosterId: number; teamName: string; ownerName: string }>) || [];
    return NextResponse.json({ teams });
  } catch (error) {
    console.error('[setup/teams GET] Error:', error);
    return NextResponse.json({ teams: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireUser();
    if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const body = await request.json();
    const { teamColors, leagueId: bodyLeagueId } = body;

    const resolved = await resolveSetupLeague(session.userId, bodyLeagueId);
    if (!resolved) {
      return NextResponse.json(
        { error: 'No league found. Please start setup from the beginning.' },
        { status: 400 }
      );
    }

    const db = getDb();
    await db.execute(sql`
      UPDATE leagues SET
        team_colors = ${JSON.stringify(teamColors || {})}::jsonb,
        config = jsonb_set(
          COALESCE(config, '{}'),
          '{completedSetupSteps}',
          (
            SELECT COALESCE(config->'completedSetupSteps', '[]'::jsonb) || '["teams"]'::jsonb
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
