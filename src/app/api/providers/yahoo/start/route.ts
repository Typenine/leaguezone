import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { resolveOwnedSetupLeagueId } from '@/lib/server/setup-league-context';
import { buildYahooAuthorizationUrl, isYahooAvailable } from '@/lib/providers/yahoo';
import { createYahooOAuthState } from '@/lib/providers/yahoo-oauth-state';

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

  const state = createYahooOAuthState(session.userId, leagueId);
  return NextResponse.redirect(buildYahooAuthorizationUrl(state));
}
