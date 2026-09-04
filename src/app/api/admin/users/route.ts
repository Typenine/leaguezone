import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { getUnderlyingPlatformAdminUserFromRequest } from '@/lib/server/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const admin = await getUnderlyingPlatformAdminUserFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'Platform admin required' }, { status: 403 });
  const db = getDb();
  const [usersRes, membershipsRes, commissionersRes] = await Promise.all([
    db.execute(sql`
      SELECT id::text, email, display_name, role, email_verified, created_at
      FROM users ORDER BY created_at DESC
    `),
    db.execute(sql`
      SELECT li.claimed_by::text AS user_id, l.id::text AS league_id, l.slug AS league_slug,
             l.name AS league_name, li.team_name, li.roster_id,
             (l.commissioner_user_id = li.claimed_by) AS is_commissioner
      FROM league_invites li
      JOIN leagues l ON l.id = li.league_id
      WHERE li.claimed_by IS NOT NULL
      ORDER BY l.name, li.roster_id NULLS LAST
    `),
    db.execute(sql`
      SELECT l.commissioner_user_id::text AS user_id, l.id::text AS league_id,
             l.slug AS league_slug, l.name AS league_name
      FROM leagues l WHERE l.commissioner_user_id IS NOT NULL
    `),
  ]);
  const users = (usersRes as { rows?: Array<Record<string, unknown>> }).rows ?? [];
  const memberships = (membershipsRes as { rows?: Array<Record<string, unknown>> }).rows ?? [];
  const commissioners = (commissionersRes as { rows?: Array<Record<string, unknown>> }).rows ?? [];
  const byUser = new Map<string, Array<Record<string, unknown>>>();
  for (const row of memberships) {
    const key = String(row.user_id);
    byUser.set(key, [...(byUser.get(key) || []), row]);
  }
  for (const row of commissioners) {
    const key = String(row.user_id);
    const current = byUser.get(key) || [];
    if (!current.some((item) => item.league_id === row.league_id)) {
      current.push({ ...row, team_name: 'Commissioner', roster_id: null, is_commissioner: true });
      byUser.set(key, current);
    }
  }
  return NextResponse.json({
    currentAdminUserId: admin.id,
    users: users.map((user) => ({ ...user, memberships: byUser.get(String(user.id)) || [] })),
  });
}

export async function PATCH(req: NextRequest) {
  const admin = await getUnderlyingPlatformAdminUserFromRequest(req);
  if (!admin) return NextResponse.json({ error: 'Platform admin required' }, { status: 403 });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const userId = typeof body.userId === 'string' ? body.userId : '';
  const role = body.role === 'admin' ? 'admin' : body.role === 'user' ? 'user' : '';
  if (!userId || !role) return NextResponse.json({ error: 'userId and role required' }, { status: 400 });
  if (userId === admin.id && role !== 'admin') return NextResponse.json({ error: 'You cannot remove your own platform-admin access.' }, { status: 400 });
  const result = await getDb().execute(sql`
    UPDATE users SET role = ${role}::user_role WHERE id = ${userId}::uuid
    RETURNING id::text, email, display_name, role
  `);
  const row = (result as { rows?: Array<Record<string, unknown>> }).rows?.[0];
  if (!row) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  return NextResponse.json({ ok: true, user: row });
}
