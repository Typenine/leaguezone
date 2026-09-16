import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { exchangeYahooAuthorizationCode, isYahooAvailable } from '@/lib/providers/yahoo';
import { saveYahooProviderAccount } from '@/lib/server/provider-accounts';
import { requireUser } from '@/lib/server/session';
import { requireSetupLeagueOwnership } from '@/lib/server/setup-ownership';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function providerPage(request: NextRequest, params: Record<string, string>): URL {
  const url = new URL('/setup/provider', request.url);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

function redirectAndClearOAuth(request: NextRequest, params: Record<string, string>): NextResponse {
  const response = NextResponse.redirect(providerPage(request, params));
  response.cookies.set('lz_yahoo_oauth_state', '', { path: '/', maxAge: 0 });
  response.cookies.set('lz_yahoo_oauth_league', '', { path: '/', maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  const session = await requireUser();
  if (!session) return redirectAndClearOAuth(request, { yahooError: 'session' });
  if (!isYahooAvailable()) return redirectAndClearOAuth(request, { yahooError: 'unavailable' });

  const url = new URL(request.url);
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  const oauthError = url.searchParams.get('error');
  const jar = await cookies();
  const expectedState = jar.get('lz_yahoo_oauth_state')?.value || '';
  const setupLeagueId = jar.get('lz_yahoo_oauth_league')?.value || '';

  if (oauthError) return redirectAndClearOAuth(request, { yahooError: 'denied' });
  if (!code || !state || !expectedState || state !== expectedState || !setupLeagueId) {
    return redirectAndClearOAuth(request, { yahooError: 'state' });
  }

  const ownership = await requireSetupLeagueOwnership(session.userId, setupLeagueId);
  if (!ownership) return redirectAndClearOAuth(request, { yahooError: 'league' });

  try {
    const tokens = await exchangeYahooAuthorizationCode(code);
    await saveYahooProviderAccount(session.userId, tokens);
    return redirectAndClearOAuth(request, { yahoo: 'connected' });
  } catch (error) {
    console.error('[yahoo/callback] Yahoo authorization failed:', error instanceof Error ? error.message : 'unknown error');
    return redirectAndClearOAuth(request, { yahooError: 'exchange' });
  }
}
