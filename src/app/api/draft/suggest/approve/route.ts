/**
 * POST /api/draft/suggest/approve – Admin approves a draft date suggestion.
 * Sets leagues.config.draftSuggestions[id].approvedAt and optionally
 * updates the official draft date.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isAdminCookieValue } from '@/lib/auth/admin';
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

export async function POST(req: NextRequest) {
  const jar = await cookies();
  if (!isAdminCookieValue(jar.get('evw_admin')?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const activeLeagueId = jar.get('active_league_id')?.value || undefined;

  try {
    const db = getDb();
    const res = activeLeagueId
      ? await db.execute(sql`SELECT id, config FROM leagues WHERE setup_completed = true AND id = ${activeLeagueId}::uuid LIMIT 1`)
      : await db.execute(sql`SELECT id, config FROM leagues WHERE setup_completed = true ORDER BY created_at DESC LIMIT 1`);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    if (!row) return NextResponse.json({ error: 'No league found' }, { status: 404 });

    const leagueId = row.id as string;
    const config = (row.config as Record<string, unknown>) ?? {};
    const suggestions: DraftSuggestion[] = Array.isArray(config.draftSuggestions)
      ? (config.draftSuggestions as DraftSuggestion[])
      : [];

    const idx = suggestions.findIndex((s) => s.id === id);
    if (idx < 0) return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });

    suggestions[idx] = { ...suggestions[idx], approvedAt: new Date().toISOString() };

    await db.execute(sql`
      UPDATE leagues
      SET config = ${JSON.stringify({ ...config, draftSuggestions: suggestions })}::jsonb,
          updated_at = now()
      WHERE id = ${leagueId}::uuid
    `);

    return NextResponse.json({ ok: true, suggestions });
  } catch (err) {
    console.error('[draft/suggest/approve] POST error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
