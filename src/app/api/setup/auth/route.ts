import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { requireUser } from '@/lib/server/session';
import { requireSetupLeagueOwnership } from '@/lib/server/setup-ownership';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLeagueId(userId: string, bodyLeagueId?: string): Promise<string | null> {
  const jar = await cookies();
  return (
    (typeof bodyLeagueId === 'string' ? bodyLeagueId : null) ||
    jar.get('setup_league_id')?.value ||
    jar.get('active_league_id')?.value ||
    null
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireUser();
    if (!session) return NextResponse.json({ teams: [] }, { status: 401 });

    const url = new URL(request.url);
    const leagueId = await resolveLeagueId(session.userId, url.searchParams.get('leagueId') || undefined);
    if (!leagueId) return NextResponse.json({ teams: [] });

    const db = getDb();
    const owned = await requireSetupLeagueOwnership(session.userId, leagueId);
    if (!owned) return NextResponse.json({ teams: [] });

    const invitesRes = await db.execute(sql`
      SELECT team_name, invite_code FROM league_invites WHERE league_id = ${leagueId}::uuid ORDER BY team_name
    `);
    const teams = ((invitesRes as { rows?: Array<Record<string, unknown>> }).rows || []).map((row) => ({
      teamName: row.team_name,
      inviteCode: row.invite_code,
    }));
    return NextResponse.json({ teams });
  } catch (error) {
    console.error('[setup/auth GET] Error:', error);
    return NextResponse.json({ teams: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireUser();
    if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const body = await request.json();
    const { authMethod, defaultPin, leagueId: bodyLeagueId } = body;

    const leagueId = await resolveLeagueId(session.userId, bodyLeagueId);
    if (!leagueId) {
      return NextResponse.json({ error: 'No league found. Please start setup from the beginning.' }, { status: 400 });
    }

    const db = getDb();
    const owned = await requireSetupLeagueOwnership(session.userId, leagueId);
    if (!owned) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    if (authMethod === 'pin' && defaultPin) {
      await db.execute(sql`
        UPDATE league_invites SET default_pin = ${defaultPin} WHERE league_id = ${leagueId}::uuid
      `);
    }

    await db.execute(sql`
      UPDATE leagues SET
        setup_completed = true,
        config = jsonb_set(
          jsonb_set(
            COALESCE(config, '{}'),
            '{completedSetupSteps}',
            (
              SELECT COALESCE(config->'completedSetupSteps', '[]'::jsonb) || '["auth"]'::jsonb
              FROM leagues WHERE id = ${leagueId}::uuid
            )
          ),
          '{authMethod}',
          ${JSON.stringify(authMethod || 'invite')}::jsonb
        ),
        updated_at = now()
      WHERE id = ${leagueId}::uuid
    `);

    // Clear the setup cookie now that setup is complete
    const jar = await cookies();
    jar.delete('setup_league_id');

    return NextResponse.json({ success: true, leagueId });
  } catch (error) {
    console.error('[setup/auth POST] Error:', error);
    return NextResponse.json({ error: 'Failed to save auth settings' }, { status: 500 });
  }
}
