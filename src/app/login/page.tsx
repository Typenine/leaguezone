import { Suspense } from 'react';
import { cookies } from 'next/headers';
import LoginContent from './LoginContent';
import { Card, CardContent } from '@/components/ui/Card';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

async function getTeamNames(leagueId?: string): Promise<string[]> {
  try {
    const db = getDb();
    const res = leagueId
      ? await db.execute(sql`
          SELECT DISTINCT ON (COALESCE(roster_id::text, team_name))
            team_name, roster_id
          FROM league_invites
          WHERE league_id = ${leagueId}::uuid
          ORDER BY COALESCE(roster_id::text, team_name), created_at ASC
        `)
      : await db.execute(sql`
          SELECT DISTINCT ON (COALESCE(li.roster_id::text, li.team_name))
            li.team_name, li.roster_id
          FROM league_invites li
          INNER JOIN leagues l ON l.id = li.league_id AND l.setup_completed = true
          ORDER BY COALESCE(li.roster_id::text, li.team_name), li.created_at ASC
          LIMIT 30
        `);
    const rows = (res as { rows?: Array<Record<string, unknown>> }).rows ?? [];
    return rows
      .map((r) => ({ name: r.team_name as string, rosterId: r.roster_id as number | null }))
      .filter((r) => Boolean(r.name))
      .sort((a, b) => {
        if (a.rosterId != null && b.rosterId != null) return a.rosterId - b.rosterId;
        if (a.rosterId != null) return -1;
        if (b.rosterId != null) return 1;
        return a.name.localeCompare(b.name);
      })
      .map((r) => r.name);
  } catch {
    return [];
  }
}

export default async function LoginPage() {
  const jar = await cookies();
  const activeLeagueId = jar.get('active_league_id')?.value || undefined;
  const teams = await getTeamNames(activeLeagueId);

  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <Card><CardContent>Loading&hellip;</CardContent></Card>
      </div>
    }>
      <LoginContent initialTeams={teams} />
    </Suspense>
  );
}
