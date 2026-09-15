import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { resolveOwnedSetupLeagueId } from '@/lib/server/setup-league-context';
import { buildYahooAuthorizationUrl, isYahooAvailable } from '@/lib/providers/yahoo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await requireUser();
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (!isYahooAvailable()) {
    return NextResponse.json({ error: 'Yahoo Fantasy integration is not enabled.' }, { status: 503 });
  }

  const leagueId = await resolveOwnedSetupLeagueId(session.userId);
  if (!leagueId) {
    return NextResponse.json({ error: 'No league setup is active.' }, { status: 400 });
  }

  const state = randomBytes(32).toString('base64url');
  const response = NextResponse.redirect(buildYahooAuthorizationUrl(state));
  const secure = process.env.NODE_ENV === 'production';

  response.cookies.set('lz_yahoo_oauth_state', state, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  });
  response.cookies.set('lz_yahoo_oauth_league', leagueId, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  });

  return response;
}
