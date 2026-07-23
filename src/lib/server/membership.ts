/**
 * Active-league membership helper.
 *
 * Use this instead of requireTeamUser() for all league-scoped API routes.
 * It validates the email/password session, reads the active league from the
 * cookie (or an explicit leagueId override), verifies membership, and returns
 * the user's team + roster within that specific league.
 *
 * Returns:
 *   401 → not authenticated
 *   403 → authenticated but not a member of the selected league
 */

import { cookies } from 'next/headers';
import { requireUser } from '@/lib/server/session';
import { getUserLeagues } from '@/lib/server/user-auth';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';

export type ActiveLeagueMembership = {
  userId: string;
  leagueId: string;
  leagueSlug: string;
  leagueName: string;
  teamName: string;
  rosterId: number | null;
  isCommissioner: boolean;
};

type MembershipResult =
  | { ok: true; membership: ActiveLeagueMembership }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Resolve the caller's membership for the active league.
 *
 * @param explicitLeagueId - override the cookie (e.g. when the league ID comes
 *   from the URL path). Optional.
 */
export async function getActiveLeagueMembership(
  explicitLeagueId?: string,
): Promise<MembershipResult> {
  const session = await requireUser();
  if (!session) return { ok: false, status: 401, error: 'Not authenticated' };

  const { userId } = session;

  let leagueId: string | null = explicitLeagueId ?? null;
  if (!leagueId) {
    const jar = await cookies();
    leagueId = jar.get('active_league_id')?.value ?? null;
  }

  if (!leagueId) {
    // A restored session may outlive the non-HttpOnly league-selection cookie.
    // If the user has exactly one league, that context is unambiguous.
    const leagues = await getUserLeagues(userId);
    leagueId = leagues.length === 1 ? leagues[0].leagueId : null;
  }

  if (!leagueId) {
    return { ok: false, status: 403, error: 'No active league selected' };
  }

  try {
    const db = getDb();
    const res = await db.execute(sql`
      SELECT
        li.league_id::text          AS league_id,
        l.slug                      AS league_slug,
        l.name                      AS league_name,
        li.team_name,
        li.roster_id,
        (l.commissioner_user_id = ${userId}::uuid) AS is_commissioner
      FROM league_invites li
      JOIN leagues l ON l.id = li.league_id
      WHERE li.league_id = ${leagueId}::uuid
        AND li.claimed_by = ${userId}::uuid
      LIMIT 1
    `);
    const rows = (res as { rows?: Array<Record<string, unknown>> }).rows ?? [];

    if (rows.length === 0) {
      const adminRes = await db.execute(sql`
        SELECT id::text AS id, slug, name,
               (commissioner_user_id = ${userId}::uuid) AS is_commissioner
        FROM leagues
        WHERE id = ${leagueId}::uuid
        LIMIT 1
      `);
      const adminRows = (adminRes as { rows?: Array<Record<string, unknown>> }).rows ?? [];
      if (adminRows.length === 0) {
        return { ok: false, status: 403, error: 'Not a member of this league' };
      }
      const isCommissioner = Boolean(adminRows[0].is_commissioner);
      const userRes = await db.execute(sql`
        SELECT role FROM users WHERE id = ${userId}::uuid LIMIT 1
      `);
      const userRows = (userRes as { rows?: Array<Record<string, unknown>> }).rows ?? [];
      const isSiteAdmin = userRows[0]?.role === 'admin';
      if (!isCommissioner && !isSiteAdmin) {
        return { ok: false, status: 403, error: 'Not a member of this league' };
      }
      return {
        ok: true,
        membership: {
          userId,
          leagueId: adminRows[0].id as string,
          leagueSlug: adminRows[0].slug as string,
          leagueName: adminRows[0].name as string,
          teamName: '',
          rosterId: null,
          isCommissioner: true,
        },
      };
    }

    const row = rows[0];
    return {
      ok: true,
      membership: {
        userId,
        leagueId: row.league_id as string,
        leagueSlug: row.league_slug as string,
        leagueName: row.league_name as string,
        teamName: row.team_name as string,
        rosterId: (row.roster_id as number | null) ?? null,
        isCommissioner: Boolean(row.is_commissioner),
      },
    };
  } catch (error) {
    console.error('[membership] DB error', error);
    return { ok: false, status: 403, error: 'Failed to resolve membership' };
  }
}

export async function requireActiveLeagueMembership(
  explicitLeagueId?: string,
): Promise<ActiveLeagueMembership> {
  const result = await getActiveLeagueMembership(explicitLeagueId);
  if (!result.ok) {
    throw Response.json({ error: result.error }, { status: result.status });
  }
  return result.membership;
}

export async function requireLeagueCommissioner(
  explicitLeagueId?: string,
): Promise<ActiveLeagueMembership> {
  const membership = await requireActiveLeagueMembership(explicitLeagueId);
  if (!membership.isCommissioner) {
    throw Response.json({ error: 'Commissioner access required' }, { status: 403 });
  }
  return membership;
}
