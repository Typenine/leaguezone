/**
 * GET /api/team-logos
 * Returns public team branding for the active league.
 * Accepts ?season=YYYY so historical pages can render the branding that existed that season.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { normalizeBrandPalette, type BrandPalette } from '@/lib/branding/colors';
import { getFranchiseBrandHistory } from '@/lib/server/franchise-branding';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type LegacyTeamColor = BrandPalette & { helmetIndex?: number | null };

type TeamBrandingResponse = {
  logoUrl: string | null;
  helmetColorIndex: number | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  tertiaryColor: string | null;
  quaternaryColor: string | null;
};

export async function GET(req: NextRequest) {
  try {
    const jar = await cookies();
    const activeLeagueId = jar.get('active_league_id')?.value;
    if (!activeLeagueId) return NextResponse.json({});

    const requestedSeason = Number(new URL(req.url).searchParams.get('season'));
    if (Number.isFinite(requestedSeason) && requestedSeason >= 1900 && requestedSeason <= 2200) {
      const snapshots = await getFranchiseBrandHistory({ leagueId: activeLeagueId, season: requestedSeason });
      if (snapshots.length > 0) {
        const historical: Record<string, TeamBrandingResponse> = {};
        for (const snapshot of snapshots) {
          historical[snapshot.teamName] = {
            logoUrl: snapshot.logoUrl,
            helmetColorIndex: null,
            primaryColor: snapshot.primaryColor,
            secondaryColor: snapshot.secondaryColor,
            tertiaryColor: snapshot.tertiaryColor,
            quaternaryColor: snapshot.quaternaryColor,
          };
        }
        return NextResponse.json(historical, {
          headers: { 'Cache-Control': 'private, max-age=60' },
        });
      }
    }

    const db = getDb();
    const res = await db.execute(sql`
      SELECT config, team_colors
      FROM leagues
      WHERE setup_completed = true AND id = ${activeLeagueId}::uuid
      LIMIT 1
    `);

    const rows = (res as { rows?: Array<Record<string, unknown>> }).rows;
    const row = rows?.[0];
    if (!row) return NextResponse.json({});

    const config = (row.config as Record<string, unknown>) ?? {};
    const teamLogos = (config.teamLogos as Record<string, string | null>) ?? {};
    const legacyTeamColors = (config.teamColors as Record<string, LegacyTeamColor>) ?? {};
    const canonicalTeamColors = (row.team_colors as Record<string, unknown> | null) ?? {};

    const result: Record<string, TeamBrandingResponse> = {};
    const allTeams = new Set([
      ...Object.keys(teamLogos),
      ...Object.keys(legacyTeamColors),
      ...Object.keys(canonicalTeamColors),
    ]);

    for (const team of allTeams) {
      const canonicalPalette = normalizeBrandPalette(canonicalTeamColors[team]);
      const legacyPalette = normalizeBrandPalette(legacyTeamColors[team]);
      const palette = canonicalPalette ?? legacyPalette;
      result[team] = {
        logoUrl: teamLogos[team] ?? null,
        helmetColorIndex: legacyTeamColors[team]?.helmetIndex ?? null,
        primaryColor: palette?.primary ?? null,
        secondaryColor: palette?.secondary ?? null,
        tertiaryColor: palette?.tertiary ?? null,
        quaternaryColor: palette?.quaternary ?? null,
      };
    }

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=30' },
    });
  } catch {
    return NextResponse.json({});
  }
}
