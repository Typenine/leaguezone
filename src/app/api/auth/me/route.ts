import { cookies } from 'next/headers';
import { verifySession } from '@/lib/server/auth';
import { isAdminCookieValue, isSiteAdminCookieValue } from '@/lib/auth/admin';
import { getUserById, getUserLeagues } from '@/lib/server/user-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const jar = await cookies();
  const isSiteAdmin = isSiteAdminCookieValue(jar.get('site_admin')?.value);
  const isAdmin = isAdminCookieValue(jar.get('evw_admin')?.value) || isSiteAdmin;

  const token = jar.get('evw_session')?.value || '';
  if (!token) {
    return Response.json({ authenticated: false, isAdmin, isSiteAdmin }, { status: 401 });
  }

  const claims = verifySession(token);
  if (!claims) {
    return Response.json({ authenticated: false, isAdmin, isSiteAdmin }, { status: 401 });
  }

  // New user-based session
  if (claims.type === 'user') {
    const userId = claims.sub as string;
    const [user, leagues] = await Promise.all([
      getUserById(userId),
      getUserLeagues(userId),
    ]);
    if (!user) {
      return Response.json({ authenticated: false, isAdmin, isSiteAdmin }, { status: 401 });
    }
    return Response.json({
      authenticated: true,
      isAdmin: isAdmin || user.role === 'admin',
      isSiteAdmin,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        role: user.role,
      },
      leagues,
    });
  }

  // Legacy team-based session — keep working for now
  return Response.json({ authenticated: true, isAdmin, isSiteAdmin, claims });
}
