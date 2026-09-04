import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { requireUser } from '@/lib/server/session';
import { requireSetupLeagueOwnership } from '@/lib/server/setup-ownership';

async function resolveLeagueId(bodyLeagueId?: string | null): Promise<string | null> {
  const jar = await cookies();
  return (
    (typeof bodyLeagueId === 'string' ? bodyLeagueId : null) ||
    jar.get('setup_league_id')?.value ||
    jar.get('active_league_id')?.value ||
    null
  );
}

export async function GET(request: NextRequest) {
  const session = await requireUser();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const leagueId = await resolveLeagueId(url.searchParams.get('leagueId'));
    if (!leagueId) {
      return NextResponse.json({ error: 'No league found. Please start setup from the beginning.' }, { status: 400 });
    }

    const owned = await requireSetupLeagueOwnership(session.userId, leagueId);
    if (!owned) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    const db = getDb();
    await db.execute(sql`
      UPDATE leagues SET
        config = jsonb_set(
          COALESCE(config, '{}'),
          '{completedSetupSteps}',
          (
            SELECT COALESCE(config->'completedSetupSteps', '[]'::jsonb) || '["admin"]'::jsonb
            FROM leagues WHERE id = ${leagueId}::uuid
          )
        ),
        updated_at = now()
      WHERE id = ${leagueId}::uuid
    `);

    return NextResponse.json({ success: true, skipped: true });
  } catch (error) {
    console.error('[setup/admin] GET Error:', error);
    return NextResponse.json({ error: 'Failed to skip admin step' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireUser();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { email, pin, displayName, leagueId: bodyLeagueId } = body;

    if (!email || !pin) {
      return NextResponse.json(
        { error: 'Email and PIN are required' },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(pin)) {
      return NextResponse.json(
        { error: 'PIN must be exactly 6 digits' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Resolve and verify ownership of the league being set up
    const leagueId = await resolveLeagueId(bodyLeagueId);
    if (!leagueId) {
      return NextResponse.json(
        { error: 'No league found. Please start setup from the beginning.' },
        { status: 400 }
      );
    }

    const owned = await requireSetupLeagueOwnership(session.userId, leagueId);
    if (!owned) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    // Check if email already exists
    const existingUser = await db.execute(sql`
      SELECT id FROM users WHERE email = ${email} LIMIT 1
    `);

    if ((existingUser as { rows?: Array<Record<string, unknown>> }).rows?.length) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      );
    }

    // Create admin user with PIN (stored as password_hash for simplicity)
    const userRes = await db.execute(sql`
      INSERT INTO users (email, display_name, password_hash, role, league_id)
      VALUES (${email}, ${displayName || null}, ${pin}, 'admin', ${leagueId}::uuid)
      RETURNING id
    `);

    const userId = (userRes as { rows?: Array<Record<string, unknown>> }).rows?.[0]?.id;

    // Update league config
    await db.execute(sql`
      UPDATE leagues SET
        config = jsonb_set(
          jsonb_set(
            COALESCE(config, '{}'),
            '{completedSetupSteps}',
            (
              SELECT COALESCE(config->'completedSetupSteps', '[]'::jsonb) || '["admin"]'::jsonb
              FROM leagues WHERE id = ${leagueId}::uuid
            )
          ),
          '{adminUserId}',
          ${JSON.stringify(userId)}::jsonb
        ),
        updated_at = now()
      WHERE id = ${leagueId}::uuid
    `);

    return NextResponse.json({
      success: true,
      userId,
      leagueId,
    });
  } catch (error) {
    console.error('[setup/admin] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create admin account' },
      { status: 500 }
    );
  }
}
