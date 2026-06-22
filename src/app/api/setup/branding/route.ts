import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { requireUser } from '@/lib/server/session';

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
    const { primaryColor, secondaryColor, logoUrl, leagueId: bodyLeagueId } = body;

    const jar = await cookies();
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
    const ownerCheck = await db.execute(sql`
      SELECT id FROM leagues
      WHERE id = ${leagueId}::uuid
        AND (commissioner_user_id = ${userId}::uuid OR commissioner_user_id IS NULL)
      LIMIT 1
    `);
    if (!(ownerCheck as { rows?: unknown[] }).rows?.length) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    await db.execute(sql`
      UPDATE leagues SET
        primary_color = ${primaryColor || null},
        secondary_color = ${secondaryColor || null},
        logo_url = ${logoUrl || null},
        config = jsonb_set(
          COALESCE(config, '{}'),
          '{completedSetupSteps}',
          (
            SELECT COALESCE(config->'completedSetupSteps', '[]'::jsonb) || '["branding"]'::jsonb
            FROM leagues WHERE id = ${leagueId}::uuid
          )
        ),
        updated_at = now()
      WHERE id = ${leagueId}::uuid
    `);

    return NextResponse.json({ success: true, leagueId });
  } catch (error) {
    console.error('[setup/branding] Error:', error);
    return NextResponse.json({ error: 'Failed to save branding' }, { status: 500 });
  }
}
