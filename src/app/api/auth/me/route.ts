import { cookies } from 'next/headers';
import { verifySession } from '@/lib/server/auth';
import { isAdminCookieValue, isSiteAdminCookieValue } from '@/lib/auth/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const jar = await cookies();
  const isSiteAdmin = isSiteAdminCookieValue(jar.get('site_admin')?.value);
  const isAdmin = isAdminCookieValue(jar.get('evw_admin')?.value) || isSiteAdmin;
  const token = jar.get('evw_session')?.value || '';
  if (!token) return Response.json({ authenticated: false, isAdmin, isSiteAdmin }, { status: isAdmin ? 200 : 401 });
  const claims = verifySession(token);
  if (!claims) return Response.json({ authenticated: false, isAdmin, isSiteAdmin }, { status: isAdmin ? 200 : 401 });
  return Response.json({ authenticated: true, isAdmin, isSiteAdmin, claims });
}
