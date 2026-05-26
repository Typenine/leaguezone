import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/league/select?id=[leagueId]
 * Sets the active_league_id cookie and redirects to /home.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  const next = req.nextUrl.searchParams.get('next') || '/home';
  const destination = next.startsWith('/') ? next : '/home';
  const res = NextResponse.redirect(new URL(destination, req.url));
  res.cookies.set('active_league_id', id, {
    httpOnly: false, // readable client-side for navbar
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
