import { NextRequest, NextResponse } from 'next/server';
import { isAdminCookieValue, isSiteAdminCookieValue } from '@/lib/auth/admin';

type SessionMetadata = {
  exp?: number;
  type?: string;
  sub?: string;
  team?: string;
};

/**
 * Middleware only performs a lightweight structural/expiry check. Session
 * signatures and account state are verified by server routes and helpers.
 *
 * Do not gate email verification here. User sessions do not embed verification
 * state, and verification can change after the session is issued. The current
 * value is loaded from the database by /api/auth/me.
 */
function decodeSession(token: string): SessionMetadata | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    return JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as SessionMetadata;
  } catch {
    return null;
  }
}

function hasUsableSessionCookie(token: string, now = Date.now()): boolean {
  const session = decodeSession(token);
  if (!session) return false;
  if (typeof session.exp !== 'number' || session.exp <= now) return false;

  if (session.type === 'user') {
    return typeof session.sub === 'string' && session.sub.length > 0;
  }

  const legacyTeam = session.team || session.sub;
  return typeof legacyTeam === 'string' && legacyTeam.length > 0;
}

const PROTECTED_PREFIXES = [
  '/trade-block',
  '/vote',
  '/api/trade-block',
  '/api/votes',
  '/draft/room',
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function unauthenticatedResponse(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL('/login', req.url);
  url.searchParams.set('next', pathname + (search || ''));
  return NextResponse.redirect(url);
}

function newsletterDormantResponse(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname === '/api/newsletter' || pathname.startsWith('/api/newsletter/');

  if (isApi) {
    return NextResponse.json(
      { error: 'Newsletter feature is currently dormant.' },
      { status: 410 },
    );
  }

  if (pathname !== '/newsletter') {
    return NextResponse.redirect(new URL('/newsletter', req.url));
  }

  return null;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const adminCookie = req.cookies.get('evw_admin')?.value || '';
  const siteAdminCookie = req.cookies.get('site_admin')?.value || '';
  const isAdmin = isAdminCookieValue(adminCookie) || isSiteAdminCookieValue(siteAdminCookie);

  const newsletterEnabled = process.env.NEXT_PUBLIC_NEWSLETTER_ENABLED === 'true';
  const isNewsletterPath = pathname === '/newsletter'
    || pathname.startsWith('/newsletter/')
    || pathname === '/api/newsletter'
    || pathname.startsWith('/api/newsletter/');

  if (!newsletterEnabled && isNewsletterPath) {
    const dormantResponse = newsletterDormantResponse(req);
    if (dormantResponse) return dormantResponse;
  }

  const previewSecret = process.env.EVW_PREVIEW_SECRET || '';
  const isDraftFeaturePath = pathname === '/draft/room' || pathname === '/draft/overlay' || pathname === '/admin/draft' || pathname.startsWith('/api/draft');
  if (previewSecret && isDraftFeaturePath) {
    const draftAdminCookie = req.cookies.get('evw_admin')?.value || '';
    const siteAdminCk = req.cookies.get('site_admin')?.value || '';
    if (isAdminCookieValue(draftAdminCookie) || isSiteAdminCookieValue(siteAdminCk)) {
      // Admin allowed.
    } else {
      const key = req.nextUrl.searchParams.get('preview_key');
      if (key && key === previewSecret) {
        const url = new URL(req.url);
        url.searchParams.delete('preview_key');
        const res = NextResponse.redirect(url);
        res.cookies.set('evw_preview', previewSecret, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: 60 * 60 * 24 * 7,
        });
        return res;
      }
      const cookie = req.cookies.get('evw_preview')?.value || '';
      if (cookie !== previewSecret) {
        return NextResponse.redirect(new URL('/', req.url));
      }
    }
  }

  if (pathname === '/draft/room' && isAdmin) {
    return NextResponse.next();
  }

  if (!isProtectedPath(pathname)) return NextResponse.next();

  const sessionCookie = req.cookies.get('evw_session')?.value || '';
  if (!hasUsableSessionCookie(sessionCookie)) {
    return unauthenticatedResponse(req);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/trade-block/:path*',
    '/vote/:path*',
    '/api/trade-block/:path*',
    '/api/votes/:path*',
    '/draft/:path*',
    '/admin/draft',
    '/api/draft/:path*',
    '/newsletter/:path*',
    '/api/newsletter/:path*',
  ],
};
