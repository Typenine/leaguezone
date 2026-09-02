import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { getActiveLeagueMembership } from '@/lib/server/membership';

async function ensureTeamProspectDraftboardTable() {
  const db = getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS team_prospect_draftboard_state_v2 (
      league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
      user_id uuid NOT NULL,
      team varchar(255) NOT NULL,
      data jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (league_id, user_id)
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_team_prospect_draftboard_team_v2 ON team_prospect_draftboard_state_v2(league_id, team)`).catch(() => {});
}

export async function GET() {
  try {
    const result = await getActiveLeagueMembership();
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    const ident = result.membership;
    await ensureTeamProspectDraftboardTable();
    const db = getDb();
    const res = await db.execute(sql`
      SELECT data, updated_at
      FROM team_prospect_draftboard_state_v2
      WHERE league_id = ${ident.leagueId}::uuid AND user_id = ${ident.userId}::uuid
      LIMIT 1
    `);
    // neon-http returns { rows: [...] }, not a plain array
    const rawRows = (res as unknown as { rows?: Array<{ data: unknown; updated_at: string }> }).rows ?? [];
    const row = rawRows[0];
    return NextResponse.json({
      data: row?.data || {},
      updatedAt: row?.updated_at || null,
      team: ident.teamName,
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

    await ensureTeamProspectDraftboardTable();
    const db = getDb();
    const res = await db.execute(sql`
      INSERT INTO team_prospect_draftboard_state_v2 (league_id, user_id, team, data, updated_at)
      VALUES (${ident.leagueId}::uuid, ${ident.userId}::uuid, ${ident.teamName}, ${JSON.stringify(body.data)}::jsonb, now())
      ON CONFLICT (league_id, user_id) DO UPDATE
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
    });
  } catch (error) {
    console.error('team-prospect-draftboard POST failed', error);
    return NextResponse.json({ error: 'Failed to save board state' }, { status: 500 });
  }
}
