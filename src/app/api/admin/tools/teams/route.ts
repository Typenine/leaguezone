import { NextRequest, NextResponse } from 'next/server';
import { isAdminCookieValue, isSiteAdminCookieValue } from '@/lib/auth/admin';
import { getLeagueIdsFromDb } from '@/lib/server/league-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAdmin(req: NextRequest): boolean {
  return (
    isAdminCookieValue(req.cookies.get('evw_admin')?.value) ||
    isSiteAdminCookieValue(req.cookies.get('site_admin')?.value)
  );
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { current: leagueId } = await getLeagueIdsFromDb();
    if (!leagueId) {
      return NextResponse.json({ teams: [], error: 'No league ID configured' });
    }

    const [usersRes, rostersRes] = await Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`, { cache: 'no-store' }),
      fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`, { cache: 'no-store' }),
    ]);

    if (!usersRes.ok || !rostersRes.ok) {
      return NextResponse.json({ teams: [], error: 'Sleeper API unavailable' });
    }

    const users: Array<{
      user_id: string;
      display_name?: string;
      username?: string;
      metadata?: { team_name?: string };
    }> = await usersRes.json();

    const rosters: Array<{ roster_id: number; owner_id: string }> = await rostersRes.json();

    const userMap = new Map(users.map((u) => [u.user_id, u]));

    const teams = rosters.map((r) => {
      const user = userMap.get(r.owner_id);
      const teamName =
        user?.metadata?.team_name || user?.display_name || user?.username || `Roster ${r.roster_id}`;
      return {
        rosterId: r.roster_id,
        teamName,
        userId: r.owner_id,
        displayName: user?.display_name || user?.username || null,
      };
    }).sort((a, b) => a.rosterId - b.rosterId);

    return NextResponse.json({ teams, leagueId });
  } catch (e) {
    return NextResponse.json({ teams: [], error: e instanceof Error ? e.message : String(e) });
  }
}
