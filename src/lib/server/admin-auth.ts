import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { verifySession } from '@/lib/server/auth';
import { isAdminCookieValue, isSiteAdminCookieValue } from '@/lib/auth/admin';
import { getUserById, type UserRecord } from '@/lib/server/user-auth';

export const QA_ADMIN_ORIGIN_COOKIE = 'qa_admin_origin_session';
const QA_SESSION_COOKIE = 'lz_qa_session';

async function accountAdminFromToken(token: string | null | undefined): Promise<UserRecord | null> {
  if (!token) return null;
  const claims = verifySession(token);
  if (!claims || claims.type !== 'user' || typeof claims.sub !== 'string') return null;
  const user = await getUserById(claims.sub);
  return user?.role === 'admin' ? user : null;
}

async function accountAdmin(currentToken: string | null | undefined, qaOriginToken: string | null | undefined): Promise<UserRecord | null> {
  return (await accountAdminFromToken(currentToken)) || accountAdminFromToken(qaOriginToken);
}

/** Real platform-admin identity. Platform administration is account-role based. */
export async function getUnderlyingPlatformAdminUserFromRequest(req: NextRequest): Promise<UserRecord | null> {
  return accountAdmin(req.cookies.get('evw_session')?.value, req.cookies.get(QA_ADMIN_ORIGIN_COOKIE)?.value);
}

export async function isUnderlyingPlatformAdminRequest(req: NextRequest): Promise<boolean> {
  return Boolean(await getUnderlyingPlatformAdminUserFromRequest(req));
}

export async function isUnderlyingPlatformAdminSession(): Promise<boolean> {
  const jar = await cookies();
  return Boolean(await accountAdmin(jar.get('evw_session')?.value, jar.get(QA_ADMIN_ORIGIN_COOKIE)?.value));
}

/** QA hides platform-wide privileges from the simulated browsing perspective. */
export async function isPlatformAdminRequest(req: NextRequest): Promise<boolean> {
  if (req.cookies.get(QA_SESSION_COOKIE)?.value) return false;
  return isUnderlyingPlatformAdminRequest(req);
}

export async function isPlatformAdminSession(): Promise<boolean> {
  const jar = await cookies();
  if (jar.get(QA_SESSION_COOKIE)?.value) return false;
  return Boolean(await accountAdmin(jar.get('evw_session')?.value, jar.get(QA_ADMIN_ORIGIN_COOKIE)?.value));
}

/**
 * League-admin compatibility. Legacy cookies remain temporarily for old league
 * routes, but they no longer grant platform-admin access. In QA, account-level
 * platform admin fallback is suppressed so a team perspective behaves as a team.
 */
export async function isLeagueAdminRequest(req: NextRequest): Promise<boolean> {
  if (isAdminCookieValue(req.cookies.get('evw_admin')?.value) || isSiteAdminCookieValue(req.cookies.get('site_admin')?.value)) return true;
  if (req.cookies.get(QA_SESSION_COOKIE)?.value) return false;
  return Boolean(await accountAdmin(req.cookies.get('evw_session')?.value, req.cookies.get(QA_ADMIN_ORIGIN_COOKIE)?.value));
}
