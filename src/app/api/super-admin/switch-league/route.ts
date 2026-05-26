/**
 * POST /api/super-admin/switch-league  { leagueId }
 *
 * Site-admin-only endpoint. Sets the active_league_id cookie so the admin is
 * "inside" the target league, then redirects to /home (or ?next= param).
 */
import { NextRequest, NextResponse } from 'next/server';
import { isSiteAdminCookieValue } from '@/lib/auth/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const siteAdminCookie = req.cookies.get('site_admin')?.value;
  if (!isSiteAdminCookieValue(siteAdminCookie)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as { leagueId?: string; next?: string }));
  const leagueId = typeof body.leagueId === 'string' ? body.leagueId.trim() : '';
  if (!leagueId) {
    return NextResponse.json({ error: 'leagueId required' }, { status: 400 });
  }

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
