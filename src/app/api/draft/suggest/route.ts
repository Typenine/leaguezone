/**
 * GET  /api/draft/suggest    – list draft date suggestions
 * POST /api/draft/suggest    – submit a new draft date suggestion (requires login)
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isAdminCookieValue } from '@/lib/auth/admin';
import { verifySession } from '@/lib/server/auth';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

type DraftSuggestion = {
  id: string;
  teamName: string;
  date: string;
  notes?: string;
  approvedAt?: string;
};

async function getLeagueRow(jar: Awaited<ReturnType<typeof cookies>>) {
  const activeLeagueId = jar.get('active_league_id')?.value || undefined;
  const db = getDb();
  const res = activeLeagueId
    ? await db.execute(sql`SELECT id, config FROM leagues WHERE setup_completed = true AND id = ${activeLeagueId}::uuid LIMIT 1`)
    : await db.execute(sql`SELECT id, config FROM leagues WHERE setup_completed = true ORDER BY created_at DESC LIMIT 1`);
  return (res as { rows?: Array<Record<string, unknown>> }).rows?.[0] ?? null;
}

export async function GET() {
  try {
    const jar = await cookies();
    const row = await getLeagueRow(jar);
    if (!row) return NextResponse.json({ suggestions: [] });
    const config = (row.config as Record<string, unknown>) ?? {};
    const suggestions: DraftSuggestion[] = Array.isArray(config.draftSuggestions)
      ? (config.draftSuggestions as DraftSuggestion[])
      : [];
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const sessionToken = jar.get('evw_session')?.value || '';
  const claims = sessionToken ? verifySession(sessionToken) : null;
  const team = (claims?.team as string) || (claims?.sub as string) || '';
  const adminCookie = jar.get('evw_admin')?.value;
  const isAdmin = isAdminCookieValue(adminCookie);

  if (!team && !isAdmin) {
    return NextResponse.json({ error: 'Unauthorized — sign in first' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const dateStr = typeof body.date === 'string' ? body.date.trim() : '';
  if (!dateStr) return NextResponse.json({ error: 'date is required' }, { status: 400 });
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 });

  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 200) : undefined;
  const teamName = team || 'Admin';

  try {
    const row = await getLeagueRow(jar);
    if (!row) return NextResponse.json({ error: 'No league found' }, { status: 404 });
    const leagueId = row.id as string;
    const config = (row.config as Record<string, unknown>) ?? {};
    const suggestions: DraftSuggestion[] = Array.isArray(config.draftSuggestions)
      ? (config.draftSuggestions as DraftSuggestion[])
      : [];

    const newSugg: DraftSuggestion = {
      id: `ds-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      teamName,
      date: parsed.toISOString(),
      ...(notes ? { notes } : {}),
    };
    suggestions.push(newSugg);

    const db = getDb();
    await db.execute(sql`
      UPDATE leagues
      SET config = ${JSON.stringify({ ...config, draftSuggestions: suggestions })}::jsonb,
          updated_at = now()
      WHERE id = ${leagueId}::uuid
    `);

    return NextResponse.json({ ok: true, suggestions });
  } catch (err) {
    console.error('[draft/suggest] POST error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
