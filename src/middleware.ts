import { NextRequest, NextResponse } from 'next/server';
import { isAdminCookieValue, isSiteAdminCookieValue } from '@/lib/auth/admin';
import { isAutomatedPublicClient } from '@/lib/security/crawler-shield';

type SessionMetadata = { exp?: number; type?: string; sub?: string; team?: string };
function decodeSession(token: string): SessionMetadata | null { try { const parts = token.split('.'); if (parts.length !== 2) return null; return JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as SessionMetadata; } catch { return null; } }
function hasUsableSessionCookie(token: string, now = Date.now()): boolean { const session = decodeSession(token); if (!session || typeof session.exp !== 'number' || session.exp <= now) return false; if (session.type === 'user') return typeof session.sub === 'string' && session.sub.length > 0; const legacyTeam = session.team || session.sub; return typeof legacyTeam === 'string' && legacyTeam.length > 0; }
function hasUsableUserSessionCookie(token: string, now = Date.now()): boolean { const session = decodeSession(token); return session?.type === 'user' && hasUsableSessionCookie(token, now); }
const PROTECTED_PREFIXES = ['/trade-block', '/vote', '/api/trade-block', '/api/votes', '/draft/room'];
function isProtectedPath(pathname: string): boolean { return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)); }
function unauthenticatedResponse(req: NextRequest) { const { pathname, search } = req.nextUrl; if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); const url = new URL('/login', req.url); url.searchParams.set('next', pathname + (search || '')); return NextResponse.redirect(url); }
function newsletterDormantResponse(req: NextRequest) { const { pathname } = req.nextUrl; const isApi = pathname === '/api/newsletter' || pathname.startsWith('/api/newsletter/'); if (isApi) return NextResponse.json({ error: 'Newsletter feature is currently dormant.' }, { status: 410 }); if (pathname !== '/newsletter') return NextResponse.redirect(new URL('/newsletter', req.url)); return null; }


function safeRefererHost(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host || null;
  } catch {
    return null;
  }
}

function crawlerShieldResponse(req: NextRequest): NextResponse {
  const pathname = req.nextUrl.pathname;
  const userAgent = req.headers.get('user-agent') || '';
  console.info('[crawler-shield]', JSON.stringify({
    path: pathname,
    userAgent: userAgent.slice(0, 180),
    refererHost: safeRefererHost(req.headers.get('referer')),
  }));

  const body = req.method.toUpperCase() === 'HEAD'
    ? null
    : `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>LeagueZone</title>
</head>
<body>
  <main>
    <h1>LeagueZone</h1>
    <p>This interactive league site is available in a regular web browser.</p>
    <p><a href="/">LeagueZone home</a></p>
  </main>
</body>
</html>`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'X-LeagueZone-Crawler-Shield': '1',
    },
  });
}


function publicBrowserGateResponse(req: NextRequest): NextResponse {
  const pathname = req.nextUrl.pathname;
  console.info('[public-browser-gate]', JSON.stringify({
    path: pathname,
    userAgent: (req.headers.get('user-agent') || '').slice(0, 180),
    refererHost: safeRefererHost(req.headers.get('referer')),
  }));

  if (req.method.toUpperCase() === 'HEAD') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
        'X-LeagueZone-Browser-Gate': '1',
      },
    });
  }

  const body = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Opening LeagueZone…</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#08111f;color:#fff;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{text-align:center;padding:24px}
    p{opacity:.65}
  </style>
</head>
<body>
  <main>
    <h1>LeagueZone</h1>
    <p>Opening league site…</p>
  </main>
  <script>
    (() => {
      const secure = location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = 'lz_public_browser=1; Path=/; Max-Age=604800; SameSite=Lax' + secure;
      if (document.cookie.includes('lz_public_browser=1')) {
        location.reload();
      } else {
        document.querySelector('p').textContent = 'Enable cookies to open this league site.';
      }
    })();
  </script>
</body>
</html>`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'X-LeagueZone-Browser-Gate': '1',
    },
  });
}

const LEGACY_LEAGUE_ROOTS = ['history', 'players', 'teams', 'rosters', 'matchups', 'calendar', 'hall-of-fame', 'news', 'transactions', 'trades'] as const;

function legacyLeagueDestination(pathname: string): string | null {
  if (pathname === '/draft') return '/draft';
  if (pathname === '/trades/block' || pathname.startsWith('/trades/block/')) {
    return `/trade-block${pathname.slice('/trades/block'.length)}`;
  }
  for (const root of LEGACY_LEAGUE_ROOTS) {
    const prefix = `/${root}`;
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return pathname;
  }
  return null;
}

async function qaMutationGuard(req: NextRequest): Promise<NextResponse | null> {
  if (!req.cookies.get('lz_qa_session')?.value) return null;
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return null;
  const pathname = req.nextUrl.pathname;
  if (pathname === '/api/admin/qa' || pathname.startsWith('/api/admin/qa/')) return null;
  const mode = req.cookies.get('lz_qa_mode')?.value || 'view';
  if (mode !== 'rehearsal') {
    return NextResponse.json({ error: 'QA view-only mode does not allow changes.' }, { status: 423 });
  }
  if (pathname !== '/api/draft' && pathname !== '/api/draft/trade') {
    return NextResponse.json({ error: 'QA rehearsal can only modify its isolated draft state.' }, { status: 423 });
  }

  const rehearsalDraftId = req.cookies.get('lz_qa_draft_id')?.value || '';
  if (!rehearsalDraftId) {
    return NextResponse.json({ error: 'QA rehearsal draft is unavailable.' }, { status: 423 });
  }
  const body = await req.clone().json().catch(() => ({})) as Record<string, unknown>;
  if (pathname === '/api/draft/trade') {
    const requested = typeof body.draftId === 'string' ? body.draftId : '';
    if (requested !== rehearsalDraftId) {
      return NextResponse.json({ error: 'Draft is outside the active QA rehearsal.' }, { status: 403 });
    }
  } else {
    const requested = typeof body.id === 'string' ? body.id : '';
    if (requested && requested !== rehearsalDraftId) {
      return NextResponse.json({ error: 'Draft is outside the active QA rehearsal.' }, { status: 403 });
    }
  }
  return null;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/api/')) { const guarded = await qaMutationGuard(req); if (guarded) return guarded; }
  const qaSession = req.cookies.get('lz_qa_session')?.value || '';
  const qaMode = req.cookies.get('lz_qa_mode')?.value || '';
  const qaPerspective = req.cookies.get('lz_qa_perspective')?.value || '';
  const isQaRehearsal = Boolean(qaSession && qaMode === 'rehearsal');
  const adminCookie = req.cookies.get('evw_admin')?.value || '';
  const siteAdminCookie = req.cookies.get('site_admin')?.value || '';
  const isAdmin = isAdminCookieValue(adminCookie) || isSiteAdminCookieValue(siteAdminCookie);
  const sessionCookie = req.cookies.get('evw_session')?.value || '';
  const hasAuthenticatedViewer = hasUsableSessionCookie(sessionCookie);

  const requestMethod = req.method.toUpperCase();
  const publicLeagueSurface = pathname === '/demo' || pathname === '/l' || pathname.startsWith('/l/');
  const anonymousPublicLeagueRequest =
    (requestMethod === 'GET' || requestMethod === 'HEAD')
    && publicLeagueSurface
    && !hasAuthenticatedViewer
    && !isAdmin
    && !qaSession;

  if (anonymousPublicLeagueRequest && isAutomatedPublicClient(req.headers.get('user-agent'))) {
    return crawlerShieldResponse(req);
  }

  if (anonymousPublicLeagueRequest && req.cookies.get('lz_public_browser')?.value !== '1') {
    return publicBrowserGateResponse(req);
  }

  const newsletterEnabled = process.env.NEXT_PUBLIC_NEWSLETTER_ENABLED === 'true';
  const isNewsletterPath = pathname === '/newsletter' || pathname.startsWith('/newsletter/') || pathname === '/api/newsletter' || pathname.startsWith('/api/newsletter/');
  if (!newsletterEnabled && isNewsletterPath) { const dormant = newsletterDormantResponse(req); if (dormant) return dormant; }

  if (pathname === '/' && req.nextUrl.searchParams.get('view') !== 'public' && !qaSession) {
    if (hasUsableUserSessionCookie(sessionCookie)) { const authenticatedHome = req.nextUrl.clone(); authenticatedHome.pathname = '/app'; return NextResponse.rewrite(authenticatedHome); }
  }

  const method = req.method.toUpperCase();
  const activeLeagueSlug = req.cookies.get('active_league_slug')?.value || '';
  const hasActiveLeagueSlug = /^[a-z0-9][a-z0-9-]{0,127}$/.test(activeLeagueSlug);

  if (!qaSession && (method === 'GET' || method === 'HEAD') && hasActiveLeagueSlug && pathname === '/api/trade-analyzer/values') {
    const url = req.nextUrl.clone();
    url.pathname = '/api/trade-analyzer/values/scoped';
    return NextResponse.rewrite(url);
  }

  if (!qaSession && (method === 'GET' || method === 'HEAD') && hasActiveLeagueSlug) {
    const destination = legacyLeagueDestination(pathname);
    if (destination) {
      const url = req.nextUrl.clone();
      url.pathname = `/l/${activeLeagueSlug}${destination}`;
      return NextResponse.redirect(url);
    }
  }

  // Retain the legacy preview-key path for unauthenticated presentation displays,
  // but never make an authenticated LeagueZone member or commissioner re-enter an
  // East v. West preview secret just to view the draft presentation.
  const previewSecret = process.env.EVW_PREVIEW_SECRET || '';
  const isDraftPresentationPath = pathname === '/draft/overlay';
  if (previewSecret && isDraftPresentationPath && !isQaRehearsal) {
    if (!isAdmin && !hasAuthenticatedViewer) {
      const key = req.nextUrl.searchParams.get('preview_key');
      if (key && key === previewSecret) { const url = new URL(req.url); url.searchParams.delete('preview_key'); const res = NextResponse.redirect(url); res.cookies.set('evw_preview', previewSecret, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 7 }); return res; }
      if (req.cookies.get('evw_preview')?.value !== previewSecret) return NextResponse.redirect(new URL('/', req.url));
    }
  }

  if (pathname === '/draft/room' && isAdmin) return NextResponse.next();
  if (!isProtectedPath(pathname)) return NextResponse.next();
  if (qaSession && qaPerspective === 'public') return unauthenticatedResponse(req);
  if (!hasAuthenticatedViewer) return unauthenticatedResponse(req);
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/api/:path*',
    '/trade-block/:path*',
    '/vote/:path*',
    '/draft/:path*',
    '/admin/draft',
    '/newsletter/:path*',
    '/demo',
    '/l/:path*',
    '/history/:path*',
    '/players/:path*',
    '/teams/:path*',
    '/rosters/:path*',
    '/matchups/:path*',
    '/calendar/:path*',
    '/hall-of-fame/:path*',
    '/news/:path*',
    '/transactions/:path*',
    '/trades/:path*',
  ],
};
