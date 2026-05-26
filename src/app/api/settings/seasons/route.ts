/**
 * GET  /api/settings/seasons  – list sleeper_league_ids for current league
 * POST /api/settings/seasons  – add/remove/set-current season entry (admin only)
 *   body: { action: 'add' | 'remove' | 'set-current', year?: string, leagueId?: string }
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

type SeasonEntry = { year: string; leagueId: string; isCurrent: boolean };

async function getLeagueRow(activeLeagueId?: string) {
  const db = getDb();
  const res = activeLeagueId
    ? await db.execute(sql`SELECT id, sleeper_league_id, sleeper_league_ids FROM leagues WHERE setup_completed = true AND id = ${activeLeagueId}::uuid LIMIT 1`)
    : await db.execute(sql`SELECT id, sleeper_league_id, sleeper_league_ids FROM leagues WHERE setup_completed = true ORDER BY created_at DESC LIMIT 1`);
  return (res as { rows?: Array<Record<string, unknown>> }).rows?.[0] ?? null;
}

function buildSeasons(row: Record<string, unknown>): SeasonEntry[] {
  const current = (row.sleeper_league_id as string) || '';
  const allIds = (row.sleeper_league_ids as Record<string, string>) ?? {};
  const years = Object.keys(allIds).sort((a, b) => parseInt(b) - parseInt(a));
  return years.map((y) => ({
    year: y,
    leagueId: allIds[y],
    isCurrent: allIds[y] === current,
  }));
}

export async function GET() {
  try {
    const jar = await cookies();
    const activeLeagueId = jar.get('active_league_id')?.value || undefined;
    const row = await getLeagueRow(activeLeagueId);
    if (!row) return NextResponse.json({ seasons: [] });
    return NextResponse.json({ seasons: buildSeasons(row) });
  } catch {
    return NextResponse.json({ seasons: [] });
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const action = typeof body.action === 'string' ? body.action : '';
  const year = typeof body.year === 'string' ? body.year.trim() : '';
  const leagueId = typeof body.leagueId === 'string' ? body.leagueId.trim() : '';

  if (!['add', 'remove', 'set-current'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  try {
    const jar = await cookies();
    const activeLeagueId = jar.get('active_league_id')?.value || undefined;
    const row = await getLeagueRow(activeLeagueId);
    if (!row) return NextResponse.json({ error: 'No league found' }, { status: 404 });

    const rowId = row.id as string;
    const currentSleeperLeagueId = (row.sleeper_league_id as string) || '';
    const allIds: Record<string, string> = { ...((row.sleeper_league_ids as Record<string, string>) ?? {}) };
    const db = getDb();

    if (action === 'add') {
      if (!year || !leagueId) return NextResponse.json({ error: 'year and leagueId required' }, { status: 400 });
      allIds[year] = leagueId;
      await db.execute(sql`
        UPDATE leagues
        SET sleeper_league_ids = ${JSON.stringify(allIds)}::jsonb, updated_at = now()
        WHERE id = ${rowId}::uuid
      `);
    } else if (action === 'remove') {
      if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 });
      delete allIds[year];
      await db.execute(sql`
        UPDATE leagues
        SET sleeper_league_ids = ${JSON.stringify(allIds)}::jsonb, updated_at = now()
        WHERE id = ${rowId}::uuid
      `);
    } else if (action === 'set-current') {
      if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 });
      const targetId = allIds[year] || currentSleeperLeagueId;
      if (!targetId) return NextResponse.json({ error: 'No league ID found for that year' }, { status: 400 });
      await db.execute(sql`
        UPDATE leagues
        SET sleeper_league_id = ${targetId}, updated_at = now()
        WHERE id = ${rowId}::uuid
      `);
    }

    // Re-fetch and return updated list
    const updatedRow = await getLeagueRow(activeLeagueId);
    const seasons = updatedRow ? buildSeasons(updatedRow) : [];
    return NextResponse.json({ ok: true, seasons });
  } catch (err) {
    console.error('[settings/seasons] POST error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
