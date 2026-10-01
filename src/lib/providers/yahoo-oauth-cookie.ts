type YahooOAuthCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
  maxAge: number;
  domain?: string;
};

function normalizedBaseHost(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^www\./, '');
}

/**
 * Yahoo's registered callback may use the apex domain while a user entered
 * LeagueZone through www (or vice versa). OAuth state must survive that
 * first-party host transition.
 *
 * We only widen the cookie to the shared apex when the request host and the
 * configured Yahoo callback are the same site. Preview/vercel.app/local hosts
 * remain host-only.
 */
export function yahooOAuthCookieDomain(requestUrl: string): string | undefined {
  const redirectUri = process.env.YAHOO_REDIRECT_URI?.trim() || '';
  if (!redirectUri) return undefined;

  try {
    const requestHost = new URL(requestUrl).hostname.toLowerCase();
    const callbackHost = new URL(redirectUri).hostname.toLowerCase();
    const requestBase = normalizedBaseHost(requestHost);
    const callbackBase = normalizedBaseHost(callbackHost);

    if (!requestBase || requestBase !== callbackBase) return undefined;
    if (callbackBase === 'localhost' || !callbackBase.includes('.')) return undefined;
    if (callbackBase.endsWith('.vercel.app')) return undefined;

    return `.${callbackBase}`;
  } catch {
    return undefined;
  }
}

export function yahooOAuthCookieOptions(
  requestUrl: string,
  maxAge: number,
): YahooOAuthCookieOptions {
  const domain = yahooOAuthCookieDomain(requestUrl);
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
    ...(domain ? { domain } : {}),
  };
}
