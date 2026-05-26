import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { requireUser } from '@/lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: leagueId } = await params;
  const { userId } = session;

  try {
    const body = await req.json().catch(() => ({}));
    const inviteId = typeof body.inviteId === 'string' ? body.inviteId.trim() : '';
    if (!inviteId) return NextResponse.json({ error: 'inviteId required' }, { status: 400 });

    const db = getDb();

    // Verify user isn't already a member of this league
    const memberCheck = await db.execute(sql`
      SELECT id FROM league_invites
      WHERE league_id = ${leagueId}::uuid AND claimed_by = ${userId}::uuid
      LIMIT 1
    `);
    if (((memberCheck as { rows?: unknown[] }).rows ?? []).length > 0) {
      return NextResponse.json({ error: 'You are already a member of this league' }, { status: 409 });
    }

    // Claim the roster (only if it's still unclaimed)
    const res = await db.execute(sql`
      UPDATE league_invites
      SET claimed_by = ${userId}::uuid, claimed_at = NOW()
      WHERE id = ${inviteId}::uuid
        AND league_id = ${leagueId}::uuid
        AND claimed_by IS NULL
      RETURNING team_name, roster_id
    `);
    const rows = (res as { rows?: Array<Record<string, unknown>> }).rows ?? [];
    if (rows.length === 0) {
      return NextResponse.json({ error: 'This team has already been claimed' }, { status: 409 });
    }

    // Set active_league_id cookie
    const jar = await cookies();
    jar.set('active_league_id', leagueId, {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    return NextResponse.json({
      ok: true,
      teamName: rows[0].team_name as string,
      leagueId,
    });
  } catch (e) {
    console.error('POST /api/leagues/[id]/claim-roster failed', e);
    return NextResponse.json({ error: 'Failed to claim roster' }, { status: 500 });
  }
}
