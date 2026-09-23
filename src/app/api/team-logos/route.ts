/**
 * GET /api/team-logos
 * Returns public team branding for the active league.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { normalizeBrandPalette, type BrandPalette } from '@/lib/branding/colors';
import { getFranchiseBrandHistory } from '@/lib/server/franchise-branding';
import { guardPublicDataRequest } from '@/lib/server/public-api-guard';
import {
  readThroughReliabilityCache,
  reliabilityKey,
  reliabilityResponseHeaders,
} from '@/lib/server/reliability-cache';

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

async function loadTeamBranding(activeLeagueId: string, requestedSeason: number | null) {
  if (requestedSeason != null) {
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
      return historical;
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
  if (!row) return {};

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

  return result;
}

export async function GET(req: NextRequest) {
  const guarded = await guardPublicDataRequest(req, {
    action: 'team-logos',
    requireBrowserGate: true,
    limit: { maxRequests: 60, windowSeconds: 5 * 60 },
  });
  if (guarded) return guarded;

  const jar = await cookies();
  const activeLeagueId = jar.get('active_league_id')?.value;
  if (!activeLeagueId) return NextResponse.json({});

  const parsedSeason = Number(req.nextUrl.searchParams.get('season'));
  const requestedSeason = Number.isFinite(parsedSeason) && parsedSeason >= 1900 && parsedSeason <= 2200
    ? parsedSeason
    : null;

  try {
    const result = await readThroughReliabilityCache({
      key: reliabilityKey('team-branding', activeLeagueId, requestedSeason ?? 'current'),
      freshForSeconds: 5 * 60,
      staleForSeconds: 30 * 24 * 60 * 60,
      load: () => loadTeamBranding(activeLeagueId, requestedSeason),
    });
    return NextResponse.json(result.value, { headers: reliabilityResponseHeaders(result) });
  } catch {
    return NextResponse.json({}, { status: 503, headers: { 'Retry-After': '60' } });
  }
}
