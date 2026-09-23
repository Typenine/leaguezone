import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/server/auth';
import { isAutomatedPublicClient } from '@/lib/security/crawler-shield';
import { rateLimitByIpStrict, type RateLimitConfig } from '@/lib/server/rate-limit';

type GuardOptions = {
  action: string;
  limit?: RateLimitConfig;
  requireBrowserGate?: boolean;
  allowAutomatedClients?: boolean;
};

const DEFAULT_LIMIT: RateLimitConfig = { maxRequests: 60, windowSeconds: 5 * 60 };

function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')?.trim()
    || 'unknown';
}

function hasAuthenticatedSession(req: NextRequest): boolean {
  const token = req.cookies.get('evw_session')?.value || '';
  return Boolean(token && verifySession(token));
}

export async function guardPublicDataRequest(
  req: NextRequest,
  options: GuardOptions,
): Promise<NextResponse | null> {
  if (process.env.E2E_TEST_MODE === 'true' || process.env.E2E_TEST_MODE === '1') return null;
  if (hasAuthenticatedSession(req)) return null;

  if (!options.allowAutomatedClients && isAutomatedPublicClient(req.headers.get('user-agent'))) {
    return NextResponse.json(
      { error: 'Automated access to this data endpoint is not allowed.' },
      { status: 403, headers: { 'X-Robots-Tag': 'noindex, nofollow, noarchive' } },
    );
  }

  if (options.requireBrowserGate && req.cookies.get('lz_public_browser')?.value !== '1') {
    return NextResponse.json(
      { error: 'Open the LeagueZone league site in a browser before requesting league data.' },
      { status: 403, headers: { 'X-Robots-Tag': 'noindex, nofollow, noarchive' } },
    );
  }

  const limit = await rateLimitByIpStrict(clientIp(req), options.action, options.limit || DEFAULT_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again shortly.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))),
          ...(limit.backendAvailable === false ? { 'X-LeagueZone-RateLimit-Mode': 'local-fallback' } : {}),
        },
      },
    );
  }

  return null;
}
