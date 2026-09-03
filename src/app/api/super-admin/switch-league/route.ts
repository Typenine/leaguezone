/**
 * POST /api/super-admin/switch-league  { leagueId }
 *
 * Platform-admin-only endpoint. Sets active_league_id so the admin is inside
 * the target league, then redirects to /home (or the supplied next path).
 */
import { NextRequest, NextResponse } from 'next/server';
import { isPlatformAdminRequest } from '@/lib/server/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!(await isPlatformAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as { leagueId?: string; next?: string }));
  const leagueId = typeof body.leagueId === 'string' ? body.leagueId.trim() : '';
  if (!leagueId) return NextResponse.json({ error: 'leagueId required' }, { status: 400 });

  const redirectTo = typeof body.next === 'string' && body.next.startsWith('/') ? body.next : '/home';
  const res = NextResponse.redirect(new URL(redirectTo, req.url));
  res.cookies.set('active_league_id', leagueId, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
