import { NextRequest, NextResponse } from 'next/server';
import { exchangeYahooAuthorizationCode, isYahooAvailable } from '@/lib/providers/yahoo';
import { verifyYahooOAuthState } from '@/lib/providers/yahoo-oauth-state';
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

function redirectAndClearLegacyOAuthCookies(
  request: NextRequest,
  params: Record<string, string>,
): NextResponse {
  const response = NextResponse.redirect(providerPage(request, params));
  response.cookies.set('lz_yahoo_oauth_state', '', { path: '/', maxAge: 0 });
  response.cookies.set('lz_yahoo_oauth_league', '', { path: '/', maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  const session = await requireUser();
  if (!session) return redirectAndClearLegacyOAuthCookies(request, { yahooError: 'session' });
  if (!isYahooAvailable()) return redirectAndClearLegacyOAuthCookies(request, { yahooError: 'unavailable' });

  const url = new URL(request.url);
  const code = url.searchParams.get('code') || '';
  const stateValue = url.searchParams.get('state') || '';
  const oauthError = url.searchParams.get('error');

  if (oauthError) return redirectAndClearLegacyOAuthCookies(request, { yahooError: 'denied' });

  const state = verifyYahooOAuthState(stateValue);
  if (!code || !state || state.userId !== session.userId) {
    console.warn('[yahoo/callback] Signed OAuth state validation failed', {
      host: request.nextUrl.hostname,
      hasCode: Boolean(code),
      hasState: Boolean(stateValue),
      stateVerified: Boolean(state),
      stateUserMatches: Boolean(state && state.userId === session.userId),
    });
    return redirectAndClearLegacyOAuthCookies(request, { yahooError: 'state' });
  }

  const ownership = await requireSetupLeagueOwnership(session.userId, state.leagueId);
  if (!ownership) return redirectAndClearLegacyOAuthCookies(request, { yahooError: 'league' });

  try {
    const tokens = await exchangeYahooAuthorizationCode(code);
    await saveYahooProviderAccount(session.userId, tokens);
    return redirectAndClearLegacyOAuthCookies(request, { yahoo: 'connected' });
  } catch (error) {
    console.error('[yahoo/callback] Yahoo authorization failed:', error instanceof Error ? error.message : 'unknown error');
    return redirectAndClearLegacyOAuthCookies(request, { yahooError: 'exchange' });
  }
}
