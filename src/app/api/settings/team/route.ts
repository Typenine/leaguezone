/**
 * GET  /api/settings/team  – get team-specific settings for the logged-in team
 * POST /api/settings/team  – update team logo / colors / helmet choice
 *
 * Current values remain in leagues.team_colors/config for compatibility. Every save also
 * snapshots the current season into franchise_brand_history so future rebrands do not
 * rewrite historical pages.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/server/auth';
import { getActiveLeagueMembership } from '@/lib/server/membership';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import {
  normalizeBrandImageUrl,
  normalizeBrandPalette,
  normalizeHexColor,
  type BrandPalette,
} from '@/lib/branding/colors';
import { currentSeasonFromLeague, upsertFranchiseBrandSnapshot } from '@/lib/server/franchise-branding';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type LegacyTeamColor = {
  primary?: string | null;
  secondary?: string | null;
  tertiary?: string | null;
  quaternary?: string | null;
  helmetIndex?: number | null;
};

type StoredTeam = {
  rosterId?: number;
  ownerId?: string;
  teamName?: string;
};

/** Resolve team name and active league from either account session or legacy PIN session. */
async function resolveTeamContext(): Promise<{ team: string; leagueId: string; rosterId: number | null } | null> {
  const membership = await getActiveLeagueMembership();
  if (membership.ok) {
    return {
      team: membership.membership.teamName,
      leagueId: membership.membership.leagueId,
      rosterId: membership.membership.rosterId,
    };
  }

  const jar = await cookies();
  const token = jar.get('evw_session')?.value || '';
  const activeLeagueId = jar.get('active_league_id')?.value || '';
  if (!token || !activeLeagueId) return null;

  try {
    const claims = verifySession(token);
    const team = (claims?.team as string) || (claims?.sub as string) || null;
    if (!team) return null;
    return { team, leagueId: activeLeagueId, rosterId: null };
  } catch {
    return null;
  }
}

async function getLeagueRow(activeLeagueId: string) {
  const db = getDb();
  const res = await db.execute(sql`
    SELECT id, config, team_colors, sleeper_league_id, sleeper_league_ids
    FROM leagues
    WHERE setup_completed = true AND id = ${activeLeagueId}::uuid
    LIMIT 1
  `);
  return (res as { rows?: Array<Record<string, unknown>> }).rows?.[0] ?? null;
}

function getStoredTeamPalette(row: Record<string, unknown>, team: string): BrandPalette | null {
  const canonical = (row.team_colors as Record<string, unknown> | null) ?? {};
  const canonicalPalette = normalizeBrandPalette(canonical[team]);
  if (canonicalPalette) return canonicalPalette;

  const config = (row.config as Record<string, unknown>) ?? {};
  const legacyColors = (config.teamColors as Record<string, LegacyTeamColor>) ?? {};
  return normalizeBrandPalette(legacyColors[team]);
}

export async function GET() {
  const ctx = await resolveTeamContext();
  if (!ctx || !ctx.team) return NextResponse.json({ error: 'Unauthorized or no team selected' }, { status: 401 });

  try {
    const row = await getLeagueRow(ctx.leagueId);
    if (!row) {
      return NextResponse.json({
        logoUrl: null,
        primaryColor: null,
        secondaryColor: null,
        tertiaryColor: null,
        quaternaryColor: null,
        helmetColorIndex: null,
      });
    }

    const config = (row.config as Record<string, unknown>) ?? {};
    const teamLogos = (config.teamLogos as Record<string, string | null>) ?? {};
    const legacyColors = (config.teamColors as Record<string, LegacyTeamColor>) ?? {};
    const palette = getStoredTeamPalette(row, ctx.team);

    return NextResponse.json({
      teamName: ctx.team,
      logoUrl: teamLogos[ctx.team] ?? null,
      primaryColor: palette?.primary ?? null,
      secondaryColor: palette?.secondary ?? null,
      tertiaryColor: palette?.tertiary ?? null,
      quaternaryColor: palette?.quaternary ?? null,
      helmetColorIndex: legacyColors[ctx.team]?.helmetIndex ?? null,
    });
  } catch {
    return NextResponse.json({
      logoUrl: null,
      primaryColor: null,
      secondaryColor: null,
      tertiaryColor: null,
      quaternaryColor: null,
      helmetColorIndex: null,
    });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await resolveTeamContext();
  if (!ctx || !ctx.team) return NextResponse.json({ error: 'Unauthorized or no team selected' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const logoProvided = Object.prototype.hasOwnProperty.call(body, 'logoUrl');
  const primaryProvided = Object.prototype.hasOwnProperty.call(body, 'primaryColor');
  const secondaryProvided = Object.prototype.hasOwnProperty.call(body, 'secondaryColor');
  const tertiaryProvided = Object.prototype.hasOwnProperty.call(body, 'tertiaryColor');
  const quaternaryProvided = Object.prototype.hasOwnProperty.call(body, 'quaternaryColor');
  const helmetProvided = Object.prototype.hasOwnProperty.call(body, 'helmetColorIndex');

  const rawLogo = typeof body.logoUrl === 'string' ? body.logoUrl.trim() : '';
  const logoUrl = rawLogo ? normalizeBrandImageUrl(rawLogo) : null;
  if (logoProvided && rawLogo && !logoUrl) {
    return NextResponse.json({ error: 'Logo URL must be an http(s) URL or a site-relative path.' }, { status: 400 });
  }

  const rawPrimary = typeof body.primaryColor === 'string' ? body.primaryColor.trim() : '';
  const rawSecondary = typeof body.secondaryColor === 'string' ? body.secondaryColor.trim() : '';
  const rawTertiary = typeof body.tertiaryColor === 'string' ? body.tertiaryColor.trim() : '';
  const rawQuaternary = typeof body.quaternaryColor === 'string' ? body.quaternaryColor.trim() : '';
  const submittedPrimary = rawPrimary ? normalizeHexColor(rawPrimary) : null;
  const submittedSecondary = rawSecondary ? normalizeHexColor(rawSecondary) : null;
  const submittedTertiary = rawTertiary ? normalizeHexColor(rawTertiary) : null;
  const submittedQuaternary = rawQuaternary ? normalizeHexColor(rawQuaternary) : null;

  if (primaryProvided && !submittedPrimary) {
    return NextResponse.json({ error: 'Primary color must be a valid hex color.' }, { status: 400 });
  }
  if (secondaryProvided && !submittedSecondary) {
    return NextResponse.json({ error: 'Secondary color must be a valid hex color.' }, { status: 400 });
  }
  if (tertiaryProvided && rawTertiary && !submittedTertiary) {
    return NextResponse.json({ error: 'Tertiary color must be a valid hex color or left blank.' }, { status: 400 });
  }
  if (quaternaryProvided && rawQuaternary && !submittedQuaternary) {
    return NextResponse.json({ error: 'Quaternary color must be a valid hex color or left blank.' }, { status: 400 });
  }

  const helmetColorIndex = typeof body.helmetColorIndex === 'number' && Number.isFinite(body.helmetColorIndex)
    ? Math.max(0, Math.floor(body.helmetColorIndex))
    : null;

  try {
    const row = await getLeagueRow(ctx.leagueId);
    if (!row) return NextResponse.json({ error: 'No active league found' }, { status: 404 });

    const currentPalette = getStoredTeamPalette(row, ctx.team);
    const primary = submittedPrimary ?? currentPalette?.primary;
    const secondary = submittedSecondary ?? currentPalette?.secondary;
    if (!primary || !secondary) {
      return NextResponse.json({ error: 'Primary and secondary colors are required.' }, { status: 400 });
    }

    const tertiary = tertiaryProvided ? submittedTertiary : currentPalette?.tertiary;
    const quaternary = quaternaryProvided ? submittedQuaternary : currentPalette?.quaternary;
    const nextPalette: BrandPalette = {
      primary,
      secondary,
      ...(tertiary ? { tertiary } : {}),
      ...(quaternary ? { quaternary } : {}),
    };

    const rowId = row.id as string;
    const config = (row.config as Record<string, unknown>) ?? {};
    const teamLogos: Record<string, string | null> = {
      ...((config.teamLogos as Record<string, string | null>) ?? {}),
    };
    const teamColorsMeta: Record<string, LegacyTeamColor> = {
      ...((config.teamColors as Record<string, LegacyTeamColor>) ?? {}),
    };

    if (logoProvided) teamLogos[ctx.team] = logoUrl;
    if (helmetProvided) {
      teamColorsMeta[ctx.team] = {
        ...teamColorsMeta[ctx.team],
        helmetIndex: helmetColorIndex,
      };
    }

    const newConfig = { ...config, teamLogos, teamColors: teamColorsMeta };
    const db = getDb();
    await db.execute(sql`
      UPDATE leagues
      SET
        config = ${JSON.stringify(newConfig)}::jsonb,
        team_colors = COALESCE(team_colors, '{}'::jsonb) || ${JSON.stringify({ [ctx.team]: nextPalette })}::jsonb,
        updated_at = now()
      WHERE id = ${rowId}::uuid
    `);

    try {
      const storedTeams = Array.isArray(config.teams) ? config.teams as StoredTeam[] : [];
      const rosterId = ctx.rosterId ?? storedTeams.find((team) => team.teamName === ctx.team)?.rosterId ?? null;
      if (rosterId != null && Number.isFinite(Number(rosterId))) {
        const storedTeam = storedTeams.find((team) => Number(team.rosterId) === Number(rosterId));
        const season = currentSeasonFromLeague({
          sleeperLeagueId: row.sleeper_league_id ? String(row.sleeper_league_id) : null,
          sleeperLeagueIds: (row.sleeper_league_ids as Record<string, string> | null) || {},
        });
        await upsertFranchiseBrandSnapshot({
          leagueId: rowId,
          season,
          rosterId: Number(rosterId),
          sleeperOwnerId: storedTeam?.ownerId || null,
          teamName: ctx.team,
          logoUrl: teamLogos[ctx.team] || null,
          palette: nextPalette,
          source: 'team-settings',
        });
      }
    } catch (snapshotError) {
      console.warn('[settings/team] branding snapshot failed', snapshotError);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[settings/team] POST error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
