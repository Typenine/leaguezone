/**
 * Super-admin (site-wide) authentication.
 *
 * POST  /api/super-admin-login  { key }  → sets site_admin cookie + evw_admin cookie
 * GET   /api/super-admin-login            → { isSiteAdmin, isAdmin }
 * DELETE /api/super-admin-login           → clears site_admin cookie only
 *                                          (evw_admin is kept so the user may
 *                                          still be a per-league admin)
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getSuperAdminSecret,
  isSiteAdminCookieValue,
  getConfiguredAdminSecret,
  isAdminCookieValue,
} from '@/lib/auth/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
};

export async function GET(req: NextRequest) {
  const siteAdminCookie = req.cookies.get('site_admin')?.value;
  const evwAdminCookie = req.cookies.get('evw_admin')?.value;
  return NextResponse.json({
    isSiteAdmin: isSiteAdminCookieValue(siteAdminCookie),
    isAdmin: isAdminCookieValue(evwAdminCookie) || isSiteAdminCookieValue(siteAdminCookie),
  });
}

export async function POST(req: NextRequest) {
  const superSecret = getSuperAdminSecret();
  if (!superSecret) {
    return NextResponse.json(
      { error: 'Super admin is not configured. Set SUPER_ADMIN_KEY env var.' },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({} as { key?: string }));
  const key = typeof body?.key === 'string' ? body.key.trim() : '';

  if (key !== superSecret) {
    return NextResponse.json({ error: 'Invalid super admin key' }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true });

  // Set site_admin cookie (marks this as a site-wide admin session)
  res.cookies.set('site_admin', superSecret, COOKIE_OPTS);

  // Also set evw_admin so all existing per-league admin checks pass automatically.
  // If a league admin secret is configured, use that; otherwise re-use the site key.
  const leagueAdminSecret = getConfiguredAdminSecret() || superSecret;
  res.cookies.set('evw_admin', leagueAdminSecret, COOKIE_OPTS);

  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  // Only clear the site_admin marker; preserve evw_admin (user may still
  // want per-league admin access via separate league admin login).
  res.cookies.set('site_admin', '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  res.cookies.set('evw_admin', '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}
