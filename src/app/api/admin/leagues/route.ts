import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { getUnderlyingPlatformAdminUserFromRequest } from '@/lib/server/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdmin(req: NextRequest) {
  return getUnderlyingPlatformAdminUserFromRequest(req);
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Platform admin required' }, { status: 403 });
  const db = getDb();
  const [leagueRes, userRes] = await Promise.all([
    db.execute(sql`
      SELECT l.id::text, l.slug, l.name, l.short_name, l.sleeper_league_id, l.setup_completed, l.is_active,
             l.founded_year, l.created_at, l.commissioner_user_id::text,
             u.email AS commissioner_email, u.display_name AS commissioner_name,
             COUNT(DISTINCT COALESCE(li.roster_id::text, li.team_name)) AS roster_count,
             COUNT(DISTINCT CASE WHEN li.claimed_by IS NOT NULL THEN COALESCE(li.roster_id::text, li.team_name) END) AS claimed_count
      FROM leagues l
      LEFT JOIN users u ON u.id = l.commissioner_user_id
      LEFT JOIN league_invites li ON li.league_id = l.id
      GROUP BY l.id, u.email, u.display_name
      ORDER BY l.created_at ASC
    `),
    db.execute(sql`SELECT id::text, email, display_name, role FROM users ORDER BY lower(COALESCE(display_name, email)), lower(email)`),
  ]);
  return NextResponse.json({
    leagues: (leagueRes as { rows?: Array<Record<string, unknown>> }).rows ?? [],
    users: (userRes as { rows?: Array<Record<string, unknown>> }).rows ?? [],
  });
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Platform admin required' }, { status: 403 });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const leagueId = typeof body.leagueId === 'string' ? body.leagueId : '';
  if (!leagueId) return NextResponse.json({ error: 'leagueId required' }, { status: 400 });
  const db = getDb();

  if (Object.prototype.hasOwnProperty.call(body, 'commissionerUserId')) {
    const commissionerUserId = typeof body.commissionerUserId === 'string' && body.commissionerUserId ? body.commissionerUserId : null;
    if (commissionerUserId) {
      const check = await db.execute(sql`SELECT 1 FROM users WHERE id = ${commissionerUserId}::uuid LIMIT 1`);
      if (((check as { rows?: unknown[] }).rows ?? []).length === 0) return NextResponse.json({ error: 'Commissioner account not found' }, { status: 400 });
    }
    await db.execute(sql`UPDATE leagues SET commissioner_user_id = ${commissionerUserId}::uuid, updated_at = now() WHERE id = ${leagueId}::uuid`);
  }

  if (typeof body.isActive === 'boolean') {
    await db.execute(sql`UPDATE leagues SET is_active = ${body.isActive}, updated_at = now() WHERE id = ${leagueId}::uuid`);
  }

  return NextResponse.json({ ok: true });
}
