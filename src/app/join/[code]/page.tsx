import { notFound } from 'next/navigation';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import JoinContent from './JoinContent';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ code: string }>;
}

async function getInvite(code: string) {
  try {
    const db = getDb();
    const res = await db.execute(sql`
      SELECT
        li.id::text        AS invite_id,
        li.league_id::text AS league_id,
        li.team_name,
        li.roster_id,
        li.claimed_by::text AS claimed_by,
        l.name             AS league_name,
        l.primary_color
      FROM league_invites li
      LEFT JOIN leagues l ON l.id = li.league_id
      WHERE li.invite_code = ${code}
      LIMIT 1
    `);
    const rows = (res as { rows?: Array<Record<string, unknown>> }).rows ?? [];
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      inviteId: r.invite_id as string,
      leagueId: r.league_id as string,
      teamName: (r.team_name as string | null) ?? null,
      rosterId: (r.roster_id as number | null) ?? null,
      claimedBy: (r.claimed_by as string | null) ?? null,
      leagueName: (r.league_name as string | null) ?? null,
      primaryColor: (r.primary_color as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export default async function JoinPage({ params }: PageProps) {
  const { code } = await params;
  const invite = await getInvite(code);

  if (!invite) notFound();

  return (
    <JoinContent
      code={code}
      inviteId={invite.inviteId}
      leagueId={invite.leagueId}
      teamName={invite.teamName}
      rosterId={invite.rosterId}
      claimedBy={invite.claimedBy}
      leagueName={invite.leagueName}
      primaryColor={invite.primaryColor}
    />
  );
}
