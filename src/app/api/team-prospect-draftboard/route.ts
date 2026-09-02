import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { getActiveLeagueMembership } from '@/lib/server/membership';
import { getLeagueById } from '@/lib/server/league-context';
import { getLeague } from '@/lib/utils/sleeper-api';

async function boardConfig(leagueId: string, requested?: unknown) {
  const league = await getLeagueById(leagueId);
  const configuredYear = Number(league?.config.prospectClassYear || league?.config.draftClassYear || new Date().getUTCFullYear() + 1);
  const parsed = Number(requested);
  const sleeper = league?.sleeperLeagueId ? await getLeague(league.sleeperLeagueId).catch(() => null) : null;
  const superflex = (sleeper?.roster_positions || []).includes('SUPER_FLEX') || (sleeper?.roster_positions || []).filter((slot) => slot === 'QB').length > 1;
  const format = String(league?.config.prospectFormat || league?.config.scoringFormat || (superflex ? 'Superflex' : 'One-QB'));
  return { classYear: Number.isInteger(parsed) && parsed >= 2020 && parsed <= 2100 ? parsed : configuredYear, format };
}

export async function GET(req: NextRequest) {
  try {
    const result = await getActiveLeagueMembership();
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    const ident = result.membership;
    const config = await boardConfig(ident.leagueId, req.nextUrl.searchParams.get('classYear'));
    const db = getDb();
    const res = await db.execute(sql`
      SELECT data, updated_at
      FROM team_prospect_draftboard_state_v3
      WHERE league_id = ${ident.leagueId}::uuid AND user_id = ${ident.userId}::uuid AND draft_class_year = ${config.classYear}
      LIMIT 1
    `);
    // neon-http returns { rows: [...] }, not a plain array
    const rawRows = (res as unknown as { rows?: Array<{ data: unknown; updated_at: string }> }).rows ?? [];
    const row = rawRows[0];
    return NextResponse.json({
      data: row?.data || {},
      updatedAt: row?.updated_at || null,
      team: ident.teamName,
      classYear: config.classYear,
      format: config.format,
    });
  } catch (error) {
    console.error('team-prospect-draftboard GET failed', error);
    return NextResponse.json({ error: 'Failed to load board state' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const result = await getActiveLeagueMembership();
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    const ident = result.membership;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || !body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
      return NextResponse.json({ error: 'Request body must include a JSON object "data" field.' }, { status: 400 });
    }
    const config = await boardConfig(ident.leagueId, (body as { classYear?: unknown }).classYear);

    const db = getDb();
    const res = await db.execute(sql`
      INSERT INTO team_prospect_draftboard_state_v3 (league_id, user_id, draft_class_year, team, data, updated_at)
      VALUES (${ident.leagueId}::uuid, ${ident.userId}::uuid, ${config.classYear}, ${ident.teamName}, ${JSON.stringify(body.data)}::jsonb, now())
      ON CONFLICT (league_id, user_id, draft_class_year) DO UPDATE
      SET team = EXCLUDED.team,
          data = EXCLUDED.data,
          updated_at = now()
      RETURNING data, updated_at
    `);

    // neon-http returns { rows: [...] }, not a plain array
    const rawRows = (res as unknown as { rows?: Array<{ data: unknown; updated_at: string }> }).rows ?? [];
    const row = rawRows[0];
    return NextResponse.json({
      data: row?.data || body.data,
      updatedAt: row?.updated_at || null,
      team: ident.teamName,
      classYear: config.classYear,
      format: config.format,
    });
  } catch (error) {
    console.error('team-prospect-draftboard POST failed', error);
    return NextResponse.json({ error: 'Failed to save board state' }, { status: 500 });
  }
}
