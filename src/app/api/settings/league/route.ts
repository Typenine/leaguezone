/**
 * GET /api/settings/league  – read current league name/short name
 * POST /api/settings/league – update league name/short name (commissioner only)
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
      ? await db.execute(sql`SELECT name, short_name, founded_year FROM leagues WHERE setup_completed = true AND id = ${activeLeagueId}::uuid LIMIT 1`)
      : await db.execute(sql`SELECT name, short_name, founded_year FROM leagues WHERE setup_completed = true ORDER BY created_at ASC LIMIT 1`);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    return NextResponse.json({ name: row?.name ?? null, shortName: row?.short_name ?? null, foundedYear: row?.founded_year ?? null });
  } catch {
    return NextResponse.json({ name: null, shortName: null, foundedYear: null });
  }
}

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const isSiteAdmin = isSiteAdminCookieValue(jar.get('site_admin')?.value);
  const isLegacyAdmin = isAdminCookieValue(jar.get('evw_admin')?.value) || isSiteAdmin;

  // Allow legacy admin cookie OR new commissioner session
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
    const name = typeof body.name === 'string' ? body.name.trim() : null;
    const shortName = typeof body.shortName === 'string' ? body.shortName.trim() : null;
    const foundedYear = body.foundedYear != null ? parseInt(String(body.foundedYear), 10) || null : null;
    const db = getDb();
    await db.execute(sql`
      UPDATE leagues SET name = ${name}, short_name = ${shortName}, founded_year = ${foundedYear}, updated_at = now()
      WHERE id = ${leagueId}::uuid AND setup_completed = true
    `);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[settings/league] POST error:', err);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
