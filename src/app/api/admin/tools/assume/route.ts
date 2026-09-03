import { NextRequest, NextResponse } from 'next/server';
import { isLeagueAdminRequest, QA_ADMIN_ORIGIN_COOKIE } from '@/lib/server/admin-auth';
import { signSession, verifySession } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!(await isLeagueAdminRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const team = typeof body.team === 'string' ? body.team.trim() : '';
  if (!team) return NextResponse.json({ error: 'team is required' }, { status: 400 });

  const ttlDays = 1;
  const token = signSession({
    sub: team,
    team,
    pv: 999999,
    exp: Date.now() + ttlDays * 24 * 60 * 60 * 1000,
  });

  const res = NextResponse.json({ ok: true, team });
  const existingOrigin = req.cookies.get(QA_ADMIN_ORIGIN_COOKIE)?.value;
  const currentToken = req.cookies.get('evw_session')?.value;
  const currentClaims = currentToken ? verifySession(currentToken) : null;

  // Preserve the real DB-backed admin session separately before replacing the
  // visible user session with a team perspective. This keeps authorization and
  // auditing tied to the admin while the UI behaves like the selected team.
  if (!existingOrigin && currentToken && currentClaims?.type === 'user') {
    res.cookies.set(QA_ADMIN_ORIGIN_COOKIE, currentToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: ttlDays * 24 * 60 * 60,
    });
  }

  res.cookies.set('evw_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ttlDays * 24 * 60 * 60,
  });
  return res;
}

export async function DELETE(req: NextRequest) {
  if (!(await isLeagueAdminRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const res = NextResponse.json({ ok: true });
  const originalToken = req.cookies.get(QA_ADMIN_ORIGIN_COOKIE)?.value;
  if (originalToken) {
    res.cookies.set('evw_session', originalToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  } else {
    res.cookies.set('evw_session', '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });
  }
  res.cookies.set(QA_ADMIN_ORIGIN_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return res;
}
