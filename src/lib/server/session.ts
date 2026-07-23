import { cookies } from 'next/headers';
import { sql } from 'drizzle-orm';
import { verifySession } from '@/lib/server/auth';
import { getUserIdForTeam } from '@/lib/server/user-identity';
import { getDb } from '@/server/db/client';

async function resolveAccountTeam(
  userId: string,
  activeLeagueId: string | null,
): Promise<string | null> {
  try {
    const db = getDb();

    if (activeLeagueId) {
      const result = await db.execute(sql`
        SELECT li.team_name
        FROM league_invites li
        JOIN leagues l ON l.id = li.league_id
        WHERE li.claimed_by = ${userId}::uuid
          AND li.league_id = ${activeLeagueId}::uuid
          AND l.setup_completed = true
        LIMIT 1
      `);
      const rows = (result as { rows?: Array<Record<string, unknown>> }).rows ?? [];
      return typeof rows[0]?.team_name === 'string' ? rows[0].team_name : null;
    }

    // Older clients and restored browser sessions may be missing the active
    // league cookie. A single membership is unambiguous and safe to use.
    const result = await db.execute(sql`
      SELECT li.team_name
      FROM league_invites li
      JOIN leagues l ON l.id = li.league_id
      WHERE li.claimed_by = ${userId}::uuid
        AND l.setup_completed = true
      ORDER BY l.created_at DESC
      LIMIT 2
    `);
    const rows = (result as { rows?: Array<Record<string, unknown>> }).rows ?? [];
    if (rows.length !== 1) return null;
    return typeof rows[0]?.team_name === 'string' ? rows[0].team_name : null;
  } catch {
    return null;
  }
}

/**
 * Compatibility identity for routes that still expect a team-scoped session.
 *
 * New email/password sessions are resolved through the user's active league
 * membership. Legacy PIN sessions continue to use their signed team claim.
 */
export async function requireTeamUser(): Promise<{ team: string; userId: string } | null> {
  try {
    const jar = await cookies();
    const token = jar.get('evw_session')?.value || '';
    const claims = token ? verifySession(token) : null;
    if (!claims) return null;

    if (claims.type === 'user') {
      const userId = typeof claims.sub === 'string' ? claims.sub : '';
      if (!userId) return null;
      const activeLeagueId = jar.get('active_league_id')?.value || null;
      const team = await resolveAccountTeam(userId, activeLeagueId);
      return team ? { team, userId } : null;
    }

    const team = (claims.team as string) || (claims.sub as string) || '';
    if (!team) return null;
    return { team, userId: getUserIdForTeam(team) };
  } catch {
    return null;
  }
}

/**
 * Returns the authenticated user's UUID from an email/password session.
 * Sessions signed with signUserSession() carry { sub: userId, type: 'user' }.
 */
export async function requireUser(): Promise<{ userId: string } | null> {
  try {
    const jar = await cookies();
    const token = jar.get('evw_session')?.value || '';
    if (!token) return null;
    const claims = verifySession(token);
    if (!claims) return null;
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
