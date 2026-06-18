import { NextRequest, NextResponse } from 'next/server';
import { isAdminCookieValue, isSiteAdminCookieValue } from '@/lib/auth/admin';
import { signSession } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAdmin(req: NextRequest): boolean {
  return (
    isAdminCookieValue(req.cookies.get('evw_admin')?.value) ||
    isSiteAdminCookieValue(req.cookies.get('site_admin')?.value)
  );
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set('evw_session', '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}
