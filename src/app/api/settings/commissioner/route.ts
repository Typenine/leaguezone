import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sql } from 'drizzle-orm';
import { isAdminCookieValue, isSiteAdminCookieValue } from '@/lib/auth/admin';
import { getDb } from '@/server/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function rowToMember(row: Record<string, unknown>) {
  return {
    userId: row.user_id as string,
    teamName: row.team_name as string,
    displayName: (row.display_name as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    isCommissioner: Boolean(row.is_commissioner),
  };
}

async function getActiveLeagueId() {
  const jar = await cookies();
  return jar.get('active_league_id')?.value || undefined;
}

async function isAdminRequest() {
  const jar = await cookies();
  return isAdminCookieValue(jar.get('evw_admin')?.value) || isSiteAdminCookieValue(jar.get('site_admin')?.value);
}

export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const activeLeagueId = await getActiveLeagueId();
  if (!activeLeagueId) return NextResponse.json({ error: 'No active league selected' }, { status: 400 });

  try {
    const db = getDb();
    const res = await db.execute(sql`
      SELECT
        li.claimed_by::text AS user_id,
        li.team_name,
        u.display_name,
        u.email,
        (l.commissioner_user_id = li.claimed_by) AS is_commissioner
      FROM league_invites li
      JOIN leagues l ON l.id = li.league_id
      LEFT JOIN users u ON u.id = li.claimed_by
      WHERE li.league_id = ${activeLeagueId}::uuid
        AND li.claimed_by IS NOT NULL
      ORDER BY is_commissioner DESC, li.team_name ASC
    `);
    const rows = (res as { rows?: Array<Record<string, unknown>> }).rows ?? [];
    const leagueRes = await db.execute(sql`
      SELECT commissioner_user_id::text AS commissioner_user_id
      FROM leagues
      WHERE id = ${activeLeagueId}::uuid
      LIMIT 1
    `);
    const leagueRow = (leagueRes as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    return NextResponse.json({
      commissionerUserId: (leagueRow?.commissioner_user_id as string | null) ?? null,
      members: rows.map(rowToMember),
    });
  } catch (err) {
    console.error('[settings/commissioner] GET error:', err);
    return NextResponse.json({ error: 'Failed to load commissioner settings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const activeLeagueId = await getActiveLeagueId();
  if (!activeLeagueId) return NextResponse.json({ error: 'No active league selected' }, { status: 400 });

  try {
    const body = await req.json().catch(() => ({}));
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

    const db = getDb();
    const memberCheck = await db.execute(sql`
      SELECT id
      FROM league_invites
      WHERE league_id = ${activeLeagueId}::uuid
        AND claimed_by = ${userId}::uuid
      LIMIT 1
    `);
    if (((memberCheck as { rows?: unknown[] }).rows ?? []).length === 0) {
      return NextResponse.json({ error: 'Selected user is not a member of this league' }, { status: 400 });
    }

    const update = await db.execute(sql`
      UPDATE leagues
      SET commissioner_user_id = ${userId}::uuid,
          updated_at = now()
      WHERE id = ${activeLeagueId}::uuid
        AND commissioner_user_id IS NULL
      RETURNING commissioner_user_id::text AS commissioner_user_id
    `);
    const row = (update as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    if (!row) {
      return NextResponse.json({ error: 'This league already has a commissioner assigned' }, { status: 409 });
    }

    return NextResponse.json({ ok: true, commissionerUserId: row.commissioner_user_id });
  } catch (err) {
    console.error('[settings/commissioner] POST error:', err);
    return NextResponse.json({ error: 'Failed to assign commissioner' }, { status: 500 });
  }
}
