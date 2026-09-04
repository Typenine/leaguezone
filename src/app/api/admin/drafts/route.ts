import { NextRequest, NextResponse } from 'next/server';
import { getAllLeagues } from '@/lib/server/league-config';
import { getLeagueById } from '@/lib/server/league-context';
import { getLeagueTeamOptions } from '@/lib/server/league-teams';
import { getUnderlyingPlatformAdminUserFromRequest } from '@/lib/server/admin-auth';
import {
  archiveLiveDraft,
  createLiveDraftForLeague,
  findLiveDraftForYear,
  listLeagueDrafts,
} from '@/server/db/draft-scope-queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!(await getUnderlyingPlatformAdminUserFromRequest(req))) return NextResponse.json({ error: 'Platform admin required' }, { status: 403 });
  const leagues = await getAllLeagues();
  const drafts = (await Promise.all(leagues.map(async (league) => ({ leagueId: league.id, drafts: await listLeagueDrafts(league.id, true) }))));
  return NextResponse.json({ leagues, drafts: Object.fromEntries(drafts.map((entry) => [entry.leagueId, entry.drafts])) });
}

export async function POST(req: NextRequest) {
  if (!(await getUnderlyingPlatformAdminUserFromRequest(req))) return NextResponse.json({ error: 'Platform admin required' }, { status: 403 });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = typeof body.action === 'string' ? body.action : '';
  const leagueId = typeof body.leagueId === 'string' ? body.leagueId : '';
  const league = leagueId ? await getLeagueById(leagueId) : null;
  if (!league) return NextResponse.json({ error: 'Valid league required' }, { status: 400 });

  if (action === 'select') {
    const draftId = typeof body.draftId === 'string' ? body.draftId : '';
    const drafts = await listLeagueDrafts(leagueId, false);
    if (!drafts.some((draft) => draft.id === draftId && !draft.archivedAt)) return NextResponse.json({ error: 'Live draft not found' }, { status: 404 });
    const res = NextResponse.json({ ok: true });
    res.cookies.set('active_league_id', leagueId, { httpOnly: false, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 });
    res.cookies.set('lz_admin_draft_id', draftId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 });
    return res;
  }

  if (action === 'archive') {
    const draftId = typeof body.draftId === 'string' ? body.draftId : '';
    try {
      await archiveLiveDraft(draftId, leagueId);
      return NextResponse.json({ ok: true });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Archive failed' }, { status: 400 });
    }
  }

  if (action === 'create') {
    const year = Math.max(2000, Math.min(2200, Number(body.year || new Date().getFullYear() + 1)));
    const rounds = Math.max(1, Math.min(20, Number(body.rounds || 4)));
    const clockSeconds = Math.max(10, Math.min(86400, Number(body.clockSeconds || 60)));
    if (await findLiveDraftForYear(leagueId, year)) return NextResponse.json({ error: `A live ${year} draft already exists for this league.` }, { status: 409 });
    const teams = await getLeagueTeamOptions(leagueId);
    if (teams.length === 0) return NextResponse.json({ error: 'No league teams are available. Finish team/provider setup first.' }, { status: 400 });
    const draftId = await createLiveDraftForLeague({ leagueId, year, rounds, teams: teams.map((team) => team.teamName), clockSeconds });
    const res = NextResponse.json({ ok: true, draftId });
    res.cookies.set('active_league_id', leagueId, { httpOnly: false, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 });
    res.cookies.set('lz_admin_draft_id', draftId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 });
    return res;
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
