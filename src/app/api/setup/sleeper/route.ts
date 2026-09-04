import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { requireUser } from '@/lib/server/session';
import { requireSetupLeagueOwnership } from '@/lib/server/setup-ownership';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await requireUser();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    const { userId } = session;

    const body = await request.json();
    const { sleeperLeagueId, sleeperLeagueIds, teams, leagueId: bodyLeagueId } = body;

    if (!sleeperLeagueId) {
      return NextResponse.json({ error: 'Sleeper League ID is required' }, { status: 400 });
    }

    const jar = await cookies();
    // Prefer leagueId from body, then from setup cookie, then active_league_id
    const leagueId =
      (typeof bodyLeagueId === 'string' ? bodyLeagueId : null) ||
      jar.get('setup_league_id')?.value ||
      jar.get('active_league_id')?.value ||
      null;

    if (!leagueId) {
      return NextResponse.json(
        { error: 'No league found. Please start setup from the beginning.' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Verify ownership
    const owned = await requireSetupLeagueOwnership(userId, leagueId);
    if (!owned) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    // Update league with Sleeper info
    await db.execute(sql`
      UPDATE leagues SET
        sleeper_league_id = ${sleeperLeagueId},
        sleeper_league_ids = ${JSON.stringify(sleeperLeagueIds ?? {})}::jsonb,
        config = jsonb_set(
          jsonb_set(
            COALESCE(config, '{}'),
            '{completedSetupSteps}',
            (
              SELECT COALESCE(config->'completedSetupSteps', '[]'::jsonb) || '["sleeper"]'::jsonb
              FROM leagues WHERE id = ${leagueId}::uuid
            )
          ),
          '{teams}',
          ${JSON.stringify(teams ?? [])}::jsonb
        ),
        updated_at = now()
      WHERE id = ${leagueId}::uuid
    `);

    // Create league invites for each team
    if (teams && Array.isArray(teams)) {
      for (const team of teams) {
        const inviteCode = generateInviteCode();
        await db.execute(sql`
          INSERT INTO league_invites (league_id, team_name, roster_id, invite_code)
          VALUES (${leagueId}::uuid, ${team.teamName}, ${team.rosterId ?? null}, ${inviteCode})
          ON CONFLICT (invite_code) DO NOTHING
        `);
      }
    }

    return NextResponse.json({ success: true, leagueId });
  } catch (error) {
    console.error('[setup/sleeper] Error:', error);
    return NextResponse.json({ error: 'Failed to save Sleeper settings' }, { status: 500 });
  }
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
