/**
 * POST /api/super-admin/league/[id]/dedup-invites
 * Removes duplicate invite rows for a league, keeping the best row per roster/team.
 */
import { NextRequest, NextResponse } from 'next/server';
import { isPlatformAdminRequest } from '@/lib/server/admin-auth';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isPlatformAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  try {
    const db = getDb();
    const res = await db.execute(sql`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY league_id, COALESCE(roster_id::text, team_name)
            ORDER BY claimed_at DESC NULLS LAST, created_at ASC
          ) AS rn
        FROM league_invites
        WHERE league_id = ${id}::uuid
      ),
      keep AS (SELECT id FROM ranked WHERE rn = 1)
      DELETE FROM league_invites
      WHERE league_id = ${id}::uuid
        AND id NOT IN (SELECT id FROM keep)
      RETURNING id
    `);
    const removed = ((res as { rows?: unknown[] }).rows ?? []).length;
    return NextResponse.json({ removed });
  } catch (e) {
    console.error('POST /api/super-admin/league/[id]/dedup-invites failed', e);
    return NextResponse.json({ error: 'Dedup failed' }, { status: 500 });
  }
}
