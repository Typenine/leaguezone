import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getUserByEmail,
  verifyPassword,
  signUserSession,
  sessionCookieOptions,
  SESSION_COOKIE,
  getUserLeagues,
} from '@/lib/server/user-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const user = await getUserByEmail(email);
    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = signUserSession(user.id);
    const jar = await cookies();
    jar.set(SESSION_COOKIE, token, sessionCookieOptions());

    // Auto-set active league if user belongs to exactly one
    const leagues = await getUserLeagues(user.id);
    if (leagues.length === 1) {
      jar.set('active_league_id', leagues[0].leagueId, {
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return NextResponse.json({
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      leagues,
    });
  } catch (e) {
    console.error('POST /api/auth/login failed', e);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
