import { requireTeamUser } from '@/lib/server/session';
import { getActiveLeagueMembership } from '@/lib/server/membership';
import { readUserDoc } from '@/lib/server/user-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  // Try account session first, fall back to legacy PIN session
  const membership = await getActiveLeagueMembership();
  if (membership.ok) {
    const { userId, teamName, leagueId } = membership.membership;
    const doc = await readUserDoc(userId, teamName, leagueId);
    const v = (doc?.votes?.suggestions || {}) as Record<string, number>;
    return Response.json({ votes: v });
  }

  const ident = await requireTeamUser();
  if (!ident) return Response.json({ votes: {} });
  const doc = await readUserDoc(ident.userId, ident.team);
  const v = (doc?.votes?.suggestions || {}) as Record<string, number>;
  return Response.json({ votes: v });
}
