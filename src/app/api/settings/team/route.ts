/**
 * GET  /api/settings/team  – get team-specific settings (logo, colors) for logged-in team
 * POST /api/settings/team  – update team logo / colors
 *   body: { logoUrl?, primaryColor?, secondaryColor? }
 *   Stored in leagues.config.teamLogos[teamName] and leagues.config.teamColors[teamName]
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/server/auth';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getTeamFromCookie(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get('evw_session')?.value || '';
  if (!token) return null;
  try {
    const claims = verifySession(token);
    return (claims?.team as string) || (claims?.sub as string) || null;
  } catch {
    return null;
  }
}

async function getLeagueRow(activeLeagueId?: string) {
  const db = getDb();
  const res = activeLeagueId
    ? await db.execute(sql`SELECT id, config FROM leagues WHERE setup_completed = true AND id = ${activeLeagueId}::uuid LIMIT 1`)
    : await db.execute(sql`SELECT id, config FROM leagues WHERE setup_completed = true ORDER BY created_at DESC LIMIT 1`);
  return (res as { rows?: Array<Record<string, unknown>> }).rows?.[0] ?? null;
}

export async function GET() {
  const team = await getTeamFromCookie();
  if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const jar = await cookies();
    const activeLeagueId = jar.get('active_league_id')?.value || undefined;
    const row = await getLeagueRow(activeLeagueId);
    if (!row) return NextResponse.json({ logoUrl: null, primaryColor: null, secondaryColor: null });

    const config = (row.config as Record<string, unknown>) ?? {};
    const teamLogos = (config.teamLogos as Record<string, string>) ?? {};
    const teamColors = (config.teamColors as Record<string, { primary?: string; secondary?: string }>) ?? {};

    return NextResponse.json({
      logoUrl: teamLogos[team] ?? null,
      primaryColor: teamColors[team]?.primary ?? null,
      secondaryColor: teamColors[team]?.secondary ?? null,
      helmetColorIndex: (teamColors[team] as { helmetIndex?: number | null } | undefined)?.helmetIndex ?? null,
    });
  } catch {
    return NextResponse.json({ logoUrl: null, primaryColor: null, secondaryColor: null });
  }
}

export async function POST(req: NextRequest) {
  const team = await getTeamFromCookie();
  if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const logoUrl = typeof body.logoUrl === 'string' ? body.logoUrl.trim() || null : null;
  const primaryColor = typeof body.primaryColor === 'string' ? body.primaryColor.trim() || null : null;
  const secondaryColor = typeof body.secondaryColor === 'string' ? body.secondaryColor.trim() || null : null;
  const helmetColorIndex = typeof body.helmetColorIndex === 'number' ? Math.max(0, Math.floor(body.helmetColorIndex)) : null;

  try {
    const jar = await cookies();
    const activeLeagueId = jar.get('active_league_id')?.value || undefined;
    const row = await getLeagueRow(activeLeagueId);
    if (!row) return NextResponse.json({ error: 'No league found' }, { status: 404 });

    const rowId = row.id as string;
    const config = (row.config as Record<string, unknown>) ?? {};
    const teamLogos: Record<string, string | null> = { ...((config.teamLogos as Record<string, string>) ?? {}) };
    const teamColors: Record<string, { primary?: string | null; secondary?: string | null }> = {
      ...((config.teamColors as Record<string, { primary?: string; secondary?: string }>) ?? {}),
    };

    if (logoUrl !== undefined) teamLogos[team] = logoUrl;
    if (primaryColor !== undefined || secondaryColor !== undefined || helmetColorIndex !== undefined) {
      teamColors[team] = {
        ...teamColors[team],
        ...(primaryColor !== undefined ? { primary: primaryColor } : {}),
        ...(secondaryColor !== undefined ? { secondary: secondaryColor } : {}),
        ...(helmetColorIndex !== undefined ? { helmetIndex: helmetColorIndex } : {}),
      };
    }

    const newConfig = { ...config, teamLogos, teamColors };
    const db = getDb();
    await db.execute(sql`
      UPDATE leagues
      SET config = ${JSON.stringify(newConfig)}::jsonb, updated_at = now()
      WHERE id = ${rowId}::uuid
    `);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[settings/team] POST error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
