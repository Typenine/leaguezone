import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { hashPin, signSession } from '@/lib/server/auth';
import { writeTeamPinWithResult } from '@/lib/server/pins';
import { resolveCanonicalTeamName } from '@/lib/utils/team-utils';
import { TEAM_NAMES } from '@/lib/constants/league';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/setup-pin
 * First-time PIN creation for a team member who was invited.
 * Body: { inviteCode: string, pin: string }
 * - Validates the invite code exists and the invite is unclaimed
 * - Creates (or overwrites) the team's PIN
 * - Marks the invite as claimed
 * - Issues a session cookie
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const inviteCode = typeof body.inviteCode === 'string' ? body.inviteCode.trim() : '';
    const pin = typeof body.pin === 'string' ? body.pin.trim() : '';

    if (!inviteCode) {
      return NextResponse.json({ error: 'inviteCode required' }, { status: 400 });
    }
    if (!pin || !/^\d{4,12}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN must be 4–12 digits' }, { status: 400 });
    }

    const db = getDb();

    // Look up the invite
    const res = await db.execute(sql`
      SELECT id, team_name, claimed_at
      FROM league_invites
      WHERE invite_code = ${inviteCode}
      LIMIT 1
    `);
    const rows = (res as { rows?: Array<Record<string, unknown>> }).rows ?? [];
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 });
    }
    const invite = rows[0];
    const teamName = invite.team_name as string;
    const alreadyClaimed = Boolean(invite.claimed_at);

    // Resolve canonical team name
    let team = TEAM_NAMES.includes(teamName) ? teamName : resolveCanonicalTeamName({ rosterTeamName: teamName });
    if (team === 'Unknown Team') team = teamName;

    // Hash and store the PIN (allows re-setting even if already claimed)
    const { hash, salt } = await hashPin(pin);
    const stored = { hash, salt, pinVersion: 1, updatedAt: new Date().toISOString() };
    await writeTeamPinWithResult(team, stored);

    // Mark invite as claimed if not already
    if (!alreadyClaimed) {
      await db.execute(sql`
        UPDATE league_invites
        SET claimed_at = NOW()
        WHERE id = ${invite.id as string}::uuid
      `);
    }

    // Issue session cookie
    const ttlDays = 30;
    const payload = {
      sub: team,
      team,
      pv: 1,
      exp: Date.now() + ttlDays * 24 * 60 * 60 * 1000,
    };
    const token = signSession(payload);
    const jar = await cookies();
    jar.set('evw_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: ttlDays * 24 * 60 * 60,
    });

    return NextResponse.json({ team });
  } catch (e) {
    console.error('POST /api/auth/setup-pin failed', e);
    return NextResponse.json({ error: 'Setup failed' }, { status: 500 });
  }
}

/**
 * GET /api/auth/setup-pin?code=[inviteCode]
 * Returns the invite details (team name, claimed status) for the join page.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });

  try {
    const db = getDb();
    const res = await db.execute(sql`
      SELECT li.team_name, li.claimed_at, l.name AS league_name, l.primary_color, l.logo_url
      FROM league_invites li
      LEFT JOIN leagues l ON l.id = li.league_id
      WHERE li.invite_code = ${code}
      LIMIT 1
    `);
    const rows = (res as { rows?: Array<Record<string, unknown>> }).rows ?? [];
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const r = rows[0];
    return NextResponse.json({
      teamName: r.team_name as string,
      claimed: Boolean(r.claimed_at),
      leagueName: r.league_name as string | null,
      primaryColor: r.primary_color as string | null,
      logoUrl: r.logo_url as string | null,
    });
  } catch (e) {
    console.error('GET /api/auth/setup-pin failed', e);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
}
