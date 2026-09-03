import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { verifySession } from '@/lib/server/auth';
import { isAdminCookieValue, isSiteAdminCookieValue } from '@/lib/auth/admin';
import { getUserById } from '@/lib/server/user-auth';

export const QA_ADMIN_ORIGIN_COOKIE = 'qa_admin_origin_session';

async function isAccountPlatformAdmin(token: string | null | undefined): Promise<boolean> {
  if (!token) return false;
  const claims = verifySession(token);
  if (!claims || claims.type !== 'user' || typeof claims.sub !== 'string') return false;
  const user = await getUserById(claims.sub);
  return user?.role === 'admin';
}

async function hasAccountAdminToken(
  currentToken: string | null | undefined,
  qaOriginToken: string | null | undefined,
): Promise<boolean> {
  if (await isAccountPlatformAdmin(currentToken)) return true;
  return isAccountPlatformAdmin(qaOriginToken);
}

/** Platform-wide administration: legacy site-admin session or a DB-backed admin account. */
export async function isPlatformAdminRequest(req: NextRequest): Promise<boolean> {
  if (isSiteAdminCookieValue(req.cookies.get('site_admin')?.value)) return true;
  return hasAccountAdminToken(
    req.cookies.get('evw_session')?.value,
    req.cookies.get(QA_ADMIN_ORIGIN_COOKIE)?.value,
  );
}

/** Server-component equivalent of isPlatformAdminRequest. */
export async function isPlatformAdminSession(): Promise<boolean> {
  const jar = await cookies();
  if (isSiteAdminCookieValue(jar.get('site_admin')?.value)) return true;
  return hasAccountAdminToken(
    jar.get('evw_session')?.value,
    jar.get(QA_ADMIN_ORIGIN_COOKIE)?.value,
  );
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
  return hasAccountAdminToken(
    req.cookies.get('evw_session')?.value,
    req.cookies.get(QA_ADMIN_ORIGIN_COOKIE)?.value,
  );
}
