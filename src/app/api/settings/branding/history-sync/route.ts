import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { requireLeagueCommissioner } from '@/lib/server/membership';
import { normalizeBrandImageUrl, normalizeBrandPalette } from '@/lib/branding/colors';
import { getFranchiseBrandHistory, syncFranchiseBrandHistory, updateFranchiseBrandSnapshot } from '@/lib/server/franchise-branding';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function commissionerOrNull() {
  try {
    return await requireLeagueCommissioner();
  } catch {
    return null;
  }
}

export async function GET() {
  const membership = await commissionerOrNull();
  if (!membership) return NextResponse.json({ error: 'Commissioner access required.' }, { status: 403 });
  const history = await getFranchiseBrandHistory({ leagueId: membership.leagueId });
  return NextResponse.json({ history });
}

export async function POST() {
  const membership = await commissionerOrNull();
  if (!membership) return NextResponse.json({ error: 'Commissioner access required.' }, { status: 403 });
  try {
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

export async function PUT(req: NextRequest) {
  const membership = await commissionerOrNull();
  if (!membership) return NextResponse.json({ error: 'Commissioner access required.' }, { status: 403 });
  try {
    const body = await req.json().catch(() => ({}));
    const season = Number(body.season);
    const franchiseKey = typeof body.franchiseKey === 'string' ? body.franchiseKey.trim() : '';
    const teamName = typeof body.teamName === 'string' ? body.teamName.trim() : '';
    const abbreviation = typeof body.abbreviation === 'string' ? body.abbreviation.trim().slice(0, 32) : '';
    const rawLogo = typeof body.logoUrl === 'string' ? body.logoUrl.trim() : '';
    const logoUrl = rawLogo ? normalizeBrandImageUrl(rawLogo) : null;
    const palette = normalizeBrandPalette({
      primary: body.primaryColor,
      secondary: body.secondaryColor,
      tertiary: body.tertiaryColor,
      quaternary: body.quaternaryColor,
    });

    if (!Number.isFinite(season) || season < 1900 || season > 2200 || !franchiseKey || !teamName) {
      return NextResponse.json({ error: 'Season, franchise, and team name are required.' }, { status: 400 });
    }
    if (rawLogo && !logoUrl) return NextResponse.json({ error: 'Invalid logo URL.' }, { status: 400 });
    if (!palette) return NextResponse.json({ error: 'Primary and secondary colors are required and must be valid hex colors.' }, { status: 400 });

    const updated = await updateFranchiseBrandSnapshot({
      leagueId: membership.leagueId,
      season,
      franchiseKey,
      teamName: teamName.slice(0, 255),
      abbreviation: abbreviation || null,
      logoUrl,
      palette,
    });
    if (!updated) return NextResponse.json({ error: 'Historical franchise entry not found.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[settings/branding/history-sync] update error', error);
    return NextResponse.json({ error: 'Could not update historical branding.' }, { status: 500 });
  }
}
