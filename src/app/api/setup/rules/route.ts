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
    if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const body = await request.json();
    const { rulesContent, rulesFileKey, leagueId: bodyLeagueId } = body;

    const jar = await cookies();
    const leagueId =
      (typeof bodyLeagueId === 'string' ? bodyLeagueId : null) ||
      jar.get('setup_league_id')?.value ||
      jar.get('active_league_id')?.value ||
      null;

    if (!leagueId) {
      return NextResponse.json({ error: 'No league found. Please start setup from the beginning.' }, { status: 400 });
    }

    const db = getDb();
    const owned = await requireSetupLeagueOwnership(session.userId, leagueId);
    if (!owned) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    await db.execute(sql`
      UPDATE leagues SET
        rules_content = ${rulesContent || null},
        rules_file_key = ${rulesFileKey || null},
        config = jsonb_set(
          COALESCE(config, '{}'),
          '{completedSetupSteps}',
          (
            SELECT COALESCE(config->'completedSetupSteps', '[]'::jsonb) || '["rules"]'::jsonb
            FROM leagues WHERE id = ${leagueId}::uuid
          )
        ),
        updated_at = now()
      WHERE id = ${leagueId}::uuid
    `);

    return NextResponse.json({ success: true, leagueId });
  } catch (error) {
    console.error('[setup/rules] Error:', error);
    return NextResponse.json({ error: 'Failed to save rules' }, { status: 500 });
  }
}
