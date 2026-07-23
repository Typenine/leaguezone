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

// Paths to protect (require session cookie)
const PROTECTED_PREFIXES = [
  '/trade-block',
  '/vote',
  '/api/trade-block',
  '/api/votes',
  '/draft/room',
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function unauthenticatedResponse(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // API callers need a real 401 response. Redirecting a fetch request to the
  // HTML login page causes JSON parsing failures and repeated sign-in prompts.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL('/login', req.url);
  url.searchParams.set('next', pathname + (search || ''));
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const adminCookie = req.cookies.get('evw_admin')?.value || '';
  const siteAdminCookie = req.cookies.get('site_admin')?.value || '';
  const isAdmin = isAdminCookieValue(adminCookie) || isSiteAdminCookieValue(siteAdminCookie);

  // Optional: draft preview lock using EVW_PREVIEW_SECRET
  const previewSecret = process.env.EVW_PREVIEW_SECRET || '';
  const isDraftFeaturePath = pathname === '/draft/room' || pathname === '/draft/overlay' || pathname === '/admin/draft' || pathname.startsWith('/api/draft');
  if (previewSecret && isDraftFeaturePath) {
    // Allow admin or site admin cookie
    const draftAdminCookie = req.cookies.get('evw_admin')?.value || '';
    const siteAdminCk = req.cookies.get('site_admin')?.value || '';
    if (isAdminCookieValue(draftAdminCookie) || isSiteAdminCookieValue(siteAdminCk)) {
      // admin allowed
    } else {
      // Support one-time unlock via query param ?preview_key=SECRET (sets evw_preview cookie)
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

  // Allow admin to access Draft Room without a user session
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
  ],
};
