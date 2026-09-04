import { NextResponse } from 'next/server';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { requireLeagueCommissioner } from '@/lib/server/membership';
import { getFranchiseBrandHistory, syncFranchiseBrandHistory } from '@/lib/server/franchise-branding';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const membership = await requireLeagueCommissioner();
    const history = await getFranchiseBrandHistory({ leagueId: membership.leagueId });
    return NextResponse.json({ history });
  } catch {
    return NextResponse.json({ error: 'Commissioner access required.' }, { status: 403 });
  }
}

export async function POST() {
  try {
    const membership = await requireLeagueCommissioner();
    const db = getDb();
    const res = await db.execute(sql`
      SELECT sleeper_league_id, sleeper_league_ids, config, team_colors
      FROM leagues WHERE id = ${membership.leagueId}::uuid LIMIT 1
    `);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    if (!row) return NextResponse.json({ error: 'League not found.' }, { status: 404 });

    const result = await syncFranchiseBrandHistory({
      leagueId: membership.leagueId,
      currentSleeperLeagueId: row.sleeper_league_id ? String(row.sleeper_league_id) : null,
      sleeperLeagueIds: (row.sleeper_league_ids as Record<string, string> | null) || {},
      config: (row.config as Record<string, unknown> | null) || {},
      teamColors: (row.team_colors as Record<string, unknown> | null) || {},
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[settings/branding/history-sync] error', error);
    return NextResponse.json({ error: 'Could not sync branding history.' }, { status: 500 });
  }
}
