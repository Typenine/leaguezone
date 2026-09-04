import { cookies } from 'next/headers';
import { requireUser } from '@/lib/server/session';
import { getUserLeagues } from '@/lib/server/user-auth';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { getActiveQaSessionForUser } from '@/lib/server/qa-session';

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

export async function getActiveLeagueMembership(explicitLeagueId?: string): Promise<MembershipResult> {
  const jar = await cookies();
  const session = await requireUser();
  if (!session) return { ok: false, status: 401, error: 'Not authenticated' };
  const { userId } = session;

  if (jar.get('lz_qa_session')?.value) {
    const qa = await getActiveQaSessionForUser(userId);
    if (qa) {
      if (explicitLeagueId && explicitLeagueId !== qa.leagueId) {
        return { ok: false, status: 403, error: 'QA session is scoped to another league' };
      }
      if (qa.perspective === 'public') return { ok: false, status: 401, error: 'Not authenticated' };
      if ((qa.perspective === 'team' || qa.perspective === 'member') && !qa.teamName) {
        return { ok: false, status: 403, error: 'QA team perspective is not configured' };
      }
      return {
        ok: true,
        membership: {
          userId,
          leagueId: qa.leagueId,
          leagueSlug: qa.leagueSlug,
          leagueName: qa.leagueName,
          teamName: qa.perspective === 'commissioner' ? 'Commissioner' : qa.teamName || 'League Member',
          rosterId: qa.rosterId,
          isCommissioner: qa.perspective === 'commissioner',
        },
      };
    }
  }

  let leagueId: string | null = explicitLeagueId ?? jar.get('active_league_id')?.value ?? null;
  if (!leagueId) {
    const leagues = await getUserLeagues(userId);
    leagueId = leagues.length === 1 ? leagues[0].leagueId : null;
  }
  if (!leagueId) return { ok: false, status: 403, error: 'No active league selected' };

  try {
    const db = getDb();
    const res = await db.execute(sql`
      SELECT li.league_id::text AS league_id, l.slug AS league_slug, l.name AS league_name,
             li.team_name, li.roster_id,
             (l.commissioner_user_id = ${userId}::uuid) AS is_commissioner
      FROM league_invites li
      JOIN leagues l ON l.id = li.league_id
      WHERE li.league_id = ${leagueId}::uuid AND li.claimed_by = ${userId}::uuid
      LIMIT 1
    `);
    const rows = (res as { rows?: Array<Record<string, unknown>> }).rows ?? [];

    if (rows.length === 0) {
      const adminRes = await db.execute(sql`
        SELECT l.id::text AS id, l.slug, l.name,
               (l.commissioner_user_id = ${userId}::uuid) AS is_commissioner,
               u.role
        FROM leagues l
        JOIN users u ON u.id = ${userId}::uuid
        WHERE l.id = ${leagueId}::uuid LIMIT 1
      `);
      const row = (adminRes as { rows?: Array<Record<string, unknown>> }).rows?.[0];
      if (!row || (!Boolean(row.is_commissioner) && row.role !== 'admin')) {
        return { ok: false, status: 403, error: 'Not a member of this league' };
      }
      return {
        ok: true,
        membership: {
          userId,
          leagueId: String(row.id),
          leagueSlug: String(row.slug),
          leagueName: String(row.name),
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
        leagueId: String(row.league_id),
        leagueSlug: String(row.league_slug),
        leagueName: String(row.league_name),
        teamName: String(row.team_name),
        rosterId: row.roster_id == null ? null : Number(row.roster_id),
        isCommissioner: Boolean(row.is_commissioner),
      },
    };
  } catch (error) {
    console.error('[membership] DB error', error);
    return { ok: false, status: 403, error: 'Failed to resolve membership' };
  }
}

export async function requireActiveLeagueMembership(explicitLeagueId?: string): Promise<ActiveLeagueMembership> {
  const result = await getActiveLeagueMembership(explicitLeagueId);
  if (!result.ok) throw Response.json({ error: result.error }, { status: result.status });
  return result.membership;
}

export async function requireLeagueCommissioner(explicitLeagueId?: string): Promise<ActiveLeagueMembership> {
  const membership = await requireActiveLeagueMembership(explicitLeagueId);
  if (!membership.isCommissioner) throw Response.json({ error: 'Commissioner access required' }, { status: 403 });
  return membership;
}
