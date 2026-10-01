import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { guardPublicDataRequest } from '@/lib/server/public-api-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isValidProviderLeagueId(value: string): boolean {
  return value.length >= 3
    && value.length <= 128
    && /^[A-Za-z0-9._:-]+$/.test(value);
}

export async function GET(req: NextRequest) {
  const guarded = await guardPublicDataRequest(req, {
    action: 'league-search',
    requireBrowserGate: false,
    allowAutomatedClients: false,
    limit: { maxRequests: 10, windowSeconds: 60 },
  });
  if (guarded) return guarded;

  const providerLeagueId = (
    req.nextUrl.searchParams.get('providerLeagueId')
    || req.nextUrl.searchParams.get('sleeperLeagueId')
    || ''
  ).trim();

  if (!isValidProviderLeagueId(providerLeagueId)) {
    return NextResponse.json({ error: 'Enter a valid fantasy provider league ID' }, { status: 400 });
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
        COALESCE(
          (
            SELECT lps.provider
            FROM league_provider_seasons lps
            WHERE lps.league_id = l.id
              AND lps.provider_league_id = ${providerLeagueId}
            ORDER BY lps.is_current DESC, lps.season DESC
            LIMIT 1
          ),
          CASE
            WHEN l.sleeper_league_id = ${providerLeagueId}
              OR EXISTS (
                SELECT 1
                FROM jsonb_each_text(COALESCE(l.sleeper_league_ids, '{}'::jsonb)) AS ids(key, value)
                WHERE ids.value = ${providerLeagueId}
              )
            THEN 'sleeper'
            ELSE NULL
          END
        ) AS matched_provider,
        COALESCE(
          (
            SELECT lps.season::text
            FROM league_provider_seasons lps
            WHERE lps.league_id = l.id
              AND lps.provider_league_id = ${providerLeagueId}
            ORDER BY lps.is_current DESC, lps.season DESC
            LIMIT 1
          ),
          (
            SELECT ids.key
            FROM jsonb_each_text(COALESCE(l.sleeper_league_ids, '{}'::jsonb)) AS ids(key, value)
            WHERE ids.value = ${providerLeagueId}
            LIMIT 1
          )
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
          EXISTS (
            SELECT 1
            FROM league_provider_seasons lps
            WHERE lps.league_id = l.id
              AND lps.provider_league_id = ${providerLeagueId}
          )
          OR l.sleeper_league_id = ${providerLeagueId}
          OR EXISTS (
            SELECT 1
            FROM jsonb_each_text(COALESCE(l.sleeper_league_ids, '{}'::jsonb)) AS ids(key, value)
            WHERE ids.value = ${providerLeagueId}
          )
        )
      ORDER BY l.created_at DESC
      LIMIT 1
    `);

    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    if (!row) return NextResponse.json({ match: null });

    const matchedProvider = row.matched_provider === 'yahoo'
      ? 'yahoo'
      : row.matched_provider === 'sleeper'
        ? 'sleeper'
        : null;

    return NextResponse.json({
      match: {
        id: row.id as string,
        slug: row.slug as string,
        name: row.name as string,
        shortName: (row.short_name as string | null) ?? null,
        logoUrl: (row.logo_url as string | null) ?? null,
        primaryColor: (row.primary_color as string | null) ?? null,
        foundedYear: (row.founded_year as number | null) ?? null,
        providerLeagueId,
        matchedProvider,
        matchedSeason: row.matched_season != null ? String(row.matched_season) : null,
        openRosters: Number(row.open_rosters || 0),
      },
    });
  } catch (err) {
    console.error('[league/search] GET error:', err);
    return NextResponse.json(
      { error: 'League search is temporarily unavailable.' },
      { status: 503, headers: { 'Retry-After': '60' } },
    );
  }
}
