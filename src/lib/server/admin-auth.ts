import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { verifySession } from '@/lib/server/auth';
import { isAdminCookieValue, isSiteAdminCookieValue } from '@/lib/auth/admin';
import { getUserById } from '@/lib/server/user-auth';

async function isAccountPlatformAdmin(token: string | null | undefined): Promise<boolean> {
  if (!token) return false;
  const claims = verifySession(token);
  if (!claims || claims.type !== 'user' || typeof claims.sub !== 'string') return false;
  const user = await getUserById(claims.sub);
  return user?.role === 'admin';
}

/** Platform-wide administration: legacy site-admin session or a DB-backed admin account. */
export async function isPlatformAdminRequest(req: NextRequest): Promise<boolean> {
  if (isSiteAdminCookieValue(req.cookies.get('site_admin')?.value)) return true;
  return isAccountPlatformAdmin(req.cookies.get('evw_session')?.value);
}

/** Server-component equivalent of isPlatformAdminRequest. */
export async function isPlatformAdminSession(): Promise<boolean> {
  const jar = await cookies();
  if (isSiteAdminCookieValue(jar.get('site_admin')?.value)) return true;
  return isAccountPlatformAdmin(jar.get('evw_session')?.value);
}

/**
 * Existing league-admin routes still accept the legacy league admin cookie.
 * Platform admins inherit those permissions from their authenticated account.
 */
export async function isLeagueAdminRequest(req: NextRequest): Promise<boolean> {
  if (
    isAdminCookieValue(req.cookies.get('evw_admin')?.value) ||
    isSiteAdminCookieValue(req.cookies.get('site_admin')?.value)
  ) {
    return true;
  }
  return isAccountPlatformAdmin(req.cookies.get('evw_session')?.value);
}
