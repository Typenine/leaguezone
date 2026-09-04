import { cookies } from 'next/headers';
import { verifySession } from '@/lib/server/auth';
import { getConfiguredAdminSecret, isAdminCookieValue, isSiteAdminCookieValue } from '@/lib/auth/admin';
import { isPlatformAdminSession } from '@/lib/server/admin-auth';
import { getUserById, getUserLeagues } from '@/lib/server/user-auth';
import { getActiveQaSessionForUser } from '@/lib/server/qa-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const jar = await cookies();
  const isSiteAdmin = isSiteAdminCookieValue(jar.get('site_admin')?.value);
  const cookieAdmin = isAdminCookieValue(jar.get('evw_admin')?.value) || isSiteAdmin;
  const activeLeagueId = jar.get('active_league_id')?.value || null;
  const token = jar.get('evw_session')?.value || '';

  if (!token) {
    const platformAdmin = await isPlatformAdminSession();
    return Response.json({ authenticated: false, isAdmin: cookieAdmin || platformAdmin, isPlatformAdmin: platformAdmin, isSiteAdmin }, { status: 401 });
  }
  const claims = verifySession(token);
  if (!claims) return Response.json({ authenticated: false, isAdmin: false, isPlatformAdmin: false, isSiteAdmin: false }, { status: 401 });

  if (claims.type === 'user') {
    const userId = claims.sub as string;
    const [user, leagues] = await Promise.all([getUserById(userId), getUserLeagues(userId)]);
    if (!user) return Response.json({ authenticated: false, isAdmin: false, isPlatformAdmin: false, isSiteAdmin: false }, { status: 401 });

    const qa = jar.get('lz_qa_session')?.value ? await getActiveQaSessionForUser(userId) : null;
    if (qa) {
      if (qa.perspective === 'public') {
        return Response.json({ authenticated: false, isAdmin: false, isPlatformAdmin: false, isSiteAdmin: false, qaActive: true });
      }
      const commissioner = qa.perspective === 'commissioner';
      const teamName = commissioner ? 'Commissioner' : qa.teamName || 'League Member';
      return Response.json({
        authenticated: true,
        isAdmin: commissioner,
        isPlatformAdmin: false,
        isSiteAdmin: false,
        qaActive: true,
        claims: { type: 'user', sub: userId, exp: claims.exp, team: commissioner ? undefined : qa.teamName || undefined },
        user: {
          id: user.id,
          email: user.email,
          displayName: commissioner ? 'Commissioner' : qa.teamName || 'League Member',
          emailVerified: true,
          role: 'user',
        },
        leagues: [{
          leagueId: qa.leagueId,
          leagueSlug: qa.leagueSlug,
          leagueName: qa.leagueName,
          teamName,
          rosterId: qa.rosterId,
          isCommissioner: commissioner,
        }],
        activeTeam: {
          teamName,
          leagueId: qa.leagueId,
          leagueSlug: qa.leagueSlug,
          leagueName: qa.leagueName,
          rosterId: qa.rosterId,
          isCommissioner: commissioner,
        },
      });
    }

    const platformAdmin = await isPlatformAdminSession();
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
      : leagues.length === 1 ? leagues[0] : null;

    return Response.json({
      authenticated: true,
      isAdmin: cookieAdmin || platformAdmin || user.role === 'admin' || Boolean(activeMembership?.isCommissioner),
      isPlatformAdmin: platformAdmin || user.role === 'admin',
      isSiteAdmin,
      claims: { type: 'user', sub: userId, exp: claims.exp, team: activeMembership?.teamName },
      user: { id: user.id, email: user.email, displayName: user.displayName, emailVerified: user.emailVerified, role: user.role },
      leagues,
      activeTeam: activeMembership ? {
        teamName: activeMembership.teamName,
        leagueId: activeMembership.leagueId,
        leagueSlug: activeMembership.leagueSlug,
        leagueName: activeMembership.leagueName,
        rosterId: activeMembership.rosterId,
        isCommissioner: activeMembership.isCommissioner,
      } : null,
    });
  }

  const platformAdmin = await isPlatformAdminSession();
  const legacyTeam = typeof claims.team === 'string' ? claims.team : typeof claims.sub === 'string' ? claims.sub : '';
  return Response.json({
    authenticated: true,
    isAdmin: cookieAdmin || platformAdmin,
    isPlatformAdmin: platformAdmin,
    isSiteAdmin,
    claims,
    user: legacyTeam ? { id: legacyTeam, email: '', displayName: legacyTeam, emailVerified: true, role: 'user' } : undefined,
    activeTeam: null,
    leagues: [],
  });
}
