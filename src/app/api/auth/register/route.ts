import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import {
  createUser,
  getUserByEmail,
  signUserSession,
  sessionCookieOptions,
  SESSION_COOKIE,
  validateEmail,
  validatePassword,
  validateDisplayName,
  getUserLeagues,
} from '@/lib/server/user-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';
    const inviteCode = typeof body.inviteCode === 'string' ? body.inviteCode.trim() : '';

    // Validate fields
    const emailErr = validateEmail(email);
    if (emailErr) return NextResponse.json({ error: emailErr }, { status: 400 });

    const nameErr = validateDisplayName(displayName);
    if (nameErr) return NextResponse.json({ error: nameErr }, { status: 400 });

    const passErr = validatePassword(password);
    if (passErr) return NextResponse.json({ error: passErr }, { status: 400 });

    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
    }

    // Check email uniqueness
    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: 'An account with that email already exists' }, { status: 409 });
    }

    // Create account
    const user = await createUser(email, displayName, password);

    // If an invite code was provided, look it up so we can set active_league_id
    let activeLeagueId: string | null = null;
    if (inviteCode) {
      try {
        const db = getDb();
        const res = await db.execute(sql`
          SELECT league_id::text AS league_id FROM league_invites
          WHERE invite_code = ${inviteCode} LIMIT 1
        `);
        const rows = (res as { rows?: Array<Record<string, unknown>> }).rows ?? [];
        if (rows[0]) activeLeagueId = rows[0].league_id as string;
      } catch { /* ignore */ }
    }

    // Sign session
    const token = signUserSession(user.id);
    const jar = await cookies();
    jar.set(SESSION_COOKIE, token, sessionCookieOptions());

    // Set active league if determined
    if (activeLeagueId) {
      jar.set('active_league_id', activeLeagueId, {
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    const leagues = await getUserLeagues(user.id);

    return NextResponse.json({
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      leagues,
    });
  } catch (e) {
    console.error('POST /api/auth/register failed', e);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
