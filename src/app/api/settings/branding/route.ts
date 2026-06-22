/**
 * GET  /api/settings/branding  – read league branding (logo, colors)
 * POST /api/settings/branding  – update branding (commissioner only)
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
      ? await db.execute(sql`SELECT logo_url, primary_color, secondary_color FROM leagues WHERE setup_completed = true AND id = ${activeLeagueId}::uuid LIMIT 1`)
      : await db.execute(sql`SELECT logo_url, primary_color, secondary_color FROM leagues WHERE setup_completed = true ORDER BY created_at ASC LIMIT 1`);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    return NextResponse.json({
      logoUrl: (row?.logo_url as string | null) ?? null,
      primaryColor: (row?.primary_color as string | null) ?? null,
      secondaryColor: (row?.secondary_color as string | null) ?? null,
    });
  } catch {
    return NextResponse.json({ logoUrl: null, primaryColor: null, secondaryColor: null });
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
    const logoUrl = typeof body.logoUrl === 'string' ? body.logoUrl.trim() || null : null;
    const primaryColor = typeof body.primaryColor === 'string' ? body.primaryColor.trim() || null : null;
    const secondaryColor = typeof body.secondaryColor === 'string' ? body.secondaryColor.trim() || null : null;
    const db = getDb();
    await db.execute(sql`
      UPDATE leagues
      SET logo_url = ${logoUrl}, primary_color = ${primaryColor}, secondary_color = ${secondaryColor}, updated_at = now()
      WHERE id = ${leagueId}::uuid AND setup_completed = true
    `);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[settings/branding] POST error:', err);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
