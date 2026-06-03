import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sleeperLeagueId = req.nextUrl.searchParams.get('sleeperLeagueId')?.trim();
  if (!sleeperLeagueId || !/^\d{3,}$/.test(sleeperLeagueId)) {
    return NextResponse.json({ error: 'Enter a valid Sleeper league ID' }, { status: 400 });
  }

  try {
    const db = getDb();
    const res = await db.execute(sql`
      SELECT
        l.id::text AS id,
        l.slug,
        l.name,
        l.short_name,
        l.logo_url,
        l.primary_color,
        l.founded_year,
        l.sleeper_league_id,
        (
          SELECT ids.key
          FROM jsonb_each_text(COALESCE(l.sleeper_league_ids, '{}'::jsonb)) AS ids(key, value)
          WHERE ids.value = ${sleeperLeagueId}
          LIMIT 1
        ) AS matched_season,
        (
          SELECT COUNT(*)
          FROM league_invites li
          WHERE li.league_id = l.id
            AND li.claimed_by IS NULL
        )::int AS open_rosters
      FROM leagues l
      WHERE l.setup_completed = true
        AND l.is_active = true
        AND (
          l.sleeper_league_id = ${sleeperLeagueId}
          OR EXISTS (
            SELECT 1
            FROM jsonb_each_text(COALESCE(l.sleeper_league_ids, '{}'::jsonb)) AS ids(key, value)
            WHERE ids.value = ${sleeperLeagueId}
          )
        )
      ORDER BY l.created_at DESC
      LIMIT 1
    `);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    if (!row) return NextResponse.json({ match: null });

    return NextResponse.json({
      match: {
        id: row.id as string,
        slug: row.slug as string,
        name: row.name as string,
        shortName: (row.short_name as string | null) ?? null,
        logoUrl: (row.logo_url as string | null) ?? null,
        primaryColor: (row.primary_color as string | null) ?? null,
        foundedYear: (row.founded_year as number | null) ?? null,
        sleeperLeagueId: row.sleeper_league_id as string | null,
        matchedSeason: (row.matched_season as string | null) ?? null,
        openRosters: Number(row.open_rosters || 0),
      },
    });
  } catch (err) {
    console.error('[league/search] GET error:', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
