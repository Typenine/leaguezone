/**
 * DELETE /api/super-admin/league/[id]
 *
 * Permanently deletes a league and all its invite rows.
 * Requires platform-admin authorization.
 */
import { NextRequest, NextResponse } from 'next/server';
import { isPlatformAdminRequest } from '@/lib/server/admin-auth';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
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
    await db.execute(sql`DELETE FROM league_invites WHERE league_id = ${id}::uuid`);
    const res = await db.execute(sql`DELETE FROM leagues WHERE id = ${id}::uuid RETURNING id`);
    const deleted = ((res as { rows?: unknown[] }).rows ?? []).length > 0;
    if (!deleted) return NextResponse.json({ error: 'League not found' }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    console.error('DELETE /api/super-admin/league/[id] failed', e);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
