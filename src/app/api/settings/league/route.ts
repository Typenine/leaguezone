/**
 * GET /api/settings/league  – read current league name/short name
 * POST /api/settings/league – update league name/short name (admin only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isAdminCookieValue } from '@/lib/auth/admin';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdmin(): Promise<boolean> {
  const jar = await cookies();
  return isAdminCookieValue(jar.get('evw_admin')?.value);
}

export async function GET() {
  try {
    const db = getDb();
    const res = await db.execute(sql`SELECT name, short_name, founded_year FROM leagues WHERE setup_completed = true ORDER BY created_at DESC LIMIT 1`);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    return NextResponse.json({ name: row?.name ?? null, shortName: row?.short_name ?? null, foundedYear: row?.founded_year ?? null });
  } catch {
    return NextResponse.json({ name: null, shortName: null, foundedYear: null });
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : null;
    const shortName = typeof body.shortName === 'string' ? body.shortName.trim() : null;
    const foundedYear = body.foundedYear != null ? parseInt(String(body.foundedYear), 10) || null : null;
    const db = getDb();
    await db.execute(sql`
      UPDATE leagues SET name = ${name}, short_name = ${shortName}, founded_year = ${foundedYear}
      WHERE setup_completed = true
    `);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[settings/league] POST error:', err);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
