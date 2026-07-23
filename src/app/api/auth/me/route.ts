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
  const activeLeagueId = jar.get('active_league_id')?.value || null;

  const token = jar.get('evw_session')?.value || '';
  if (!token) {
    return Response.json({ authenticated: false, isAdmin, isSiteAdmin }, { status: 401 });
  }

  const claims = verifySession(token);
  if (!claims) {
    return Response.json({ authenticated: false, isAdmin, isSiteAdmin }, { status: 401 });
  }

  if (claims.type === 'user') {
    const userId = claims.sub as string;
    const [user, leagues] = await Promise.all([
      getUserById(userId),
      getUserLeagues(userId),
    ]);
    if (!user) {
      return Response.json({ authenticated: false, isAdmin, isSiteAdmin }, { status: 401 });
    }

    const activeMembership = activeLeagueId
      ? leagues.find((league) => league.leagueId === activeLeagueId)
      : leagues.length === 1
        ? leagues[0]
        : null;

    // Keep the claims shape for older client components while the platform
    // transitions to activeTeam. The signed cookie remains the source of truth;
    // this response is only compatibility metadata.
    const compatibilityClaims = {
      type: 'user',
      sub: userId,
      exp: claims.exp,
      team: activeMembership?.teamName,
    };

    return Response.json({
      authenticated: true,
      isAdmin: isAdmin || user.role === 'admin',
      isSiteAdmin,
      claims: compatibilityClaims,
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

  return Response.json({ authenticated: true, isAdmin, isSiteAdmin, claims });
}
