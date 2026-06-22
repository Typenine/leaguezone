import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sql } from 'drizzle-orm';
import { isAdminCookieValue } from '@/lib/auth/admin';
import { getActiveLeagueMembership } from '@/lib/server/membership';
import { getDb } from '@/server/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireCommissionerOrAdmin(): Promise<boolean> {
  const jar = await cookies();
  if (isAdminCookieValue(jar.get('evw_admin')?.value)) return true;
  const m = await getActiveLeagueMembership();
  return m.ok && m.membership.isCommissioner;
}

export async function GET() {
  if (!(await requireCommissionerOrAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const jar = await cookies();
    const activeLeagueId = jar.get('active_league_id')?.value || undefined;
    const db = getDb();
    const res = activeLeagueId
      ? await db.execute(sql`SELECT config FROM leagues WHERE setup_completed = true AND id = ${activeLeagueId}::uuid LIMIT 1`)
      : await db.execute(sql`SELECT config FROM leagues WHERE setup_completed = true ORDER BY created_at DESC LIMIT 1`);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    const config = (row?.config as Record<string, unknown>) ?? {};
    const requests = Array.isArray(config.joinRequests) ? config.joinRequests : [];
    return NextResponse.json({ requests });
  } catch (err) {
    console.error('[settings/join-requests] GET error:', err);
    return NextResponse.json({ error: 'Failed to load join requests' }, { status: 500 });
  }
}
