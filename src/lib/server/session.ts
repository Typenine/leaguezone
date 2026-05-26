import { cookies } from 'next/headers';
import { verifySession } from '@/lib/server/auth';
import { getUserIdForTeam } from '@/lib/server/user-identity';

/**
 * Legacy: returns the team name + a userId derived from team name.
 * Used by PIN-era API routes. Kept for backward compatibility.
 */
export async function requireTeamUser(): Promise<{ team: string; userId: string } | null> {
  try {
    const jar = await cookies();
    const token = jar.get('evw_session')?.value || '';
    const claims = token ? verifySession(token) : null;
    const team = (claims?.team as string) || (claims?.sub as string) || '';
    if (!team) return null;
    const userId = getUserIdForTeam(team);
    return { team, userId };
  } catch {
    return null;
  }
}

/**
 * New: returns the authenticated user's UUID from an email+password session.
 * Sessions signed with signUserSession() carry { sub: userId, type: 'user' }.
 */
export async function requireUser(): Promise<{ userId: string } | null> {
  try {
    const jar = await cookies();
    const token = jar.get('evw_session')?.value || '';
    if (!token) return null;
    const claims = verifySession(token);
    if (!claims) return null;
    // New user sessions have type: 'user'
    if (claims.type === 'user') {
      const userId = claims.sub as string;
      if (!userId) return null;
      return { userId };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Returns userId whether session is new (user) or legacy (team).
 * For new sessions returns the DB user id; for legacy returns team-derived id.
 */
export async function requireAnySession(): Promise<{ userId: string; type: 'user' | 'team' } | null> {
  try {
    const jar = await cookies();
    const token = jar.get('evw_session')?.value || '';
    if (!token) return null;
    const claims = verifySession(token);
    if (!claims) return null;
    if (claims.type === 'user') {
      const userId = claims.sub as string;
      if (!userId) return null;
      return { userId, type: 'user' };
    }
    const team = (claims.team as string) || (claims.sub as string) || '';
    if (!team) return null;
    return { userId: getUserIdForTeam(team), type: 'team' };
  } catch {
    return null;
  }
}
