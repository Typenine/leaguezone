import { cookies } from 'next/headers';
import { verifySession } from '@/lib/server/auth';
import { getConfiguredAdminSecret, isAdminCookieValue, isSiteAdminCookieValue } from '@/lib/auth/admin';
import { isPlatformAdminSession } from '@/lib/server/admin-auth';
import { getUserById, getUserLeagues } from '@/lib/server/user-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const jar = await cookies();
  const isSiteAdmin = isSiteAdminCookieValue(jar.get('site_admin')?.value);
  const cookieAdmin = isAdminCookieValue(jar.get('evw_admin')?.value) || isSiteAdmin;
  const isPlatformAdmin = await isPlatformAdminSession();
  const activeLeagueId = jar.get('active_league_id')?.value || null;
  const token = jar.get('evw_session')?.value || '';

  if (!token) {
    return Response.json(
      { authenticated: false, isAdmin: cookieAdmin || isPlatformAdmin, isPlatformAdmin, isSiteAdmin },
      { status: 401 },
    );
  }
  const claims = verifySession(token);
  if (!claims) {
    return Response.json(
      { authenticated: false, isAdmin: cookieAdmin || isPlatformAdmin, isPlatformAdmin, isSiteAdmin },
      { status: 401 },
    );
  }

  if (claims.type === 'user') {
    const userId = claims.sub as string;
    const [user, leagues] = await Promise.all([getUserById(userId), getUserLeagues(userId)]);
    if (!user) {
      return Response.json(
        { authenticated: false, isAdmin: cookieAdmin || isPlatformAdmin, isPlatformAdmin, isSiteAdmin },
        { status: 401 },
      );
    }

    // Compatibility bridge while older commissioner APIs are migrated from evw_admin
    // to account/league-role authorization. The real authorization source remains
    // the authenticated platform-admin account.
    if (user.role === 'admin') {
      const legacySecret = getConfiguredAdminSecret();
      if (legacySecret && !isAdminCookieValue(jar.get('evw_admin')?.value)) {
        jar.set('evw_admin', legacySecret, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: 60 * 60 * 24 * 30,
        });
      }
    }

    const activeMembership = activeLeagueId
      ? leagues.find((league) => league.leagueId === activeLeagueId)
      : leagues.length === 1
        ? leagues[0]
        : null;

    return Response.json({
      authenticated: true,
      isAdmin: cookieAdmin || isPlatformAdmin || user.role === 'admin' || Boolean(activeMembership?.isCommissioner),
      isPlatformAdmin: isPlatformAdmin || user.role === 'admin',
      isSiteAdmin,
      claims: { type: 'user', sub: userId, exp: claims.exp, team: activeMembership?.teamName },
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        role: user.role,
      },
      leagues,
      activeTeam: activeMembership
        ? {
            teamName: activeMembership.teamName,
            leagueId: activeMembership.leagueId,
            leagueSlug: activeMembership.leagueSlug,
            leagueName: activeMembership.leagueName,
            rosterId: activeMembership.rosterId,
            isCommissioner: activeMembership.isCommissioner,
          }
        : null,
    });
  }

  const legacyTeam = typeof claims.team === 'string'
    ? claims.team
    : typeof claims.sub === 'string'
      ? claims.sub
      : '';

  return Response.json({
    authenticated: true,
    isAdmin: cookieAdmin || isPlatformAdmin,
    isPlatformAdmin,
    isSiteAdmin,
    claims,
    user: legacyTeam
      ? { id: legacyTeam, email: '', displayName: legacyTeam, emailVerified: true, role: 'user' }
      : undefined,
    activeTeam: null,
    leagues: [],
  });
}
