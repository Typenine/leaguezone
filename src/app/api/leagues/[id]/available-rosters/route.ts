import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { requireUser } from '@/lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const db = getDb();
    const res = await db.execute(sql`
      SELECT id, team_name, roster_id, invite_code
      FROM league_invites
      WHERE league_id = ${id}::uuid
        AND claimed_by IS NULL
      ORDER BY roster_id ASC NULLS LAST, team_name ASC
    `);
    const rows = (res as { rows?: Array<Record<string, unknown>> }).rows ?? [];
    return NextResponse.json({
      rosters: rows.map((r) => ({
        id: r.id as string,
        teamName: r.team_name as string,
        rosterId: (r.roster_id as number | null) ?? null,
        inviteCode: r.invite_code as string,
      })),
    });
  } catch (e) {
    console.error('GET /api/leagues/[id]/available-rosters failed', e);
    return NextResponse.json({ error: 'Failed to load rosters' }, { status: 500 });
  }
}
