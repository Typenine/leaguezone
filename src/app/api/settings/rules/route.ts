/**
 * GET  /api/settings/rules  – read league rules_content and rules_file_key
 * POST /api/settings/rules  – update rules (commissioner only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isAdminCookieValue, isSiteAdminCookieValue } from '@/lib/auth/admin';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { requireLeagueCommissioner } from '@/lib/server/membership';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const jar = await cookies();
    const activeLeagueId = jar.get('active_league_id')?.value || undefined;
    const db = getDb();
    const res = activeLeagueId
      ? await db.execute(sql`SELECT rules_content, rules_file_key FROM leagues WHERE setup_completed = true AND id = ${activeLeagueId}::uuid LIMIT 1`)
      : await db.execute(sql`SELECT rules_content, rules_file_key FROM leagues WHERE setup_completed = true ORDER BY created_at ASC LIMIT 1`);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    return NextResponse.json({
      rulesContent: (row?.rules_content as string | null) ?? null,
      rulesFileKey: (row?.rules_file_key as string | null) ?? null,
    });
  } catch {
    return NextResponse.json({ rulesContent: null, rulesFileKey: null });
  }
}

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const isSiteAdmin = isSiteAdminCookieValue(jar.get('site_admin')?.value);
  const isLegacyAdmin = isAdminCookieValue(jar.get('evw_admin')?.value) || isSiteAdmin;

  let leagueId: string | null = jar.get('active_league_id')?.value || null;

  if (!isLegacyAdmin) {
    try {
      const membership = await requireLeagueCommissioner();
      leagueId = membership.leagueId;
    } catch {
      return NextResponse.json({ error: 'Commissioner access required' }, { status: 403 });
    }
  }

  if (!leagueId) {
    return NextResponse.json({ error: 'No active league selected' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const rulesContent = typeof body.rulesContent === 'string' ? body.rulesContent || null : null;
    const rulesFileKey = typeof body.rulesFileKey === 'string' ? body.rulesFileKey.trim() || null : null;
    const db = getDb();
    await db.execute(sql`
      UPDATE leagues
      SET rules_content = ${rulesContent}, rules_file_key = ${rulesFileKey}, updated_at = now()
      WHERE id = ${leagueId}::uuid AND setup_completed = true
    `);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[settings/rules] POST error:', err);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
