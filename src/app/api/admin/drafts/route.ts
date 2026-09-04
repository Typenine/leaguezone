import { NextRequest, NextResponse } from 'next/server';
import { normalizeDraftPlayerPoolType } from '@/lib/draft/player-pool';
import { getAllLeagues } from '@/lib/server/league-config';
import { getLeagueById } from '@/lib/server/league-context';
import { getLeagueTeamOptions } from '@/lib/server/league-teams';
import { getUnderlyingPlatformAdminUserFromRequest } from '@/lib/server/admin-auth';
import {
  archiveLiveDraft,
  createLiveDraftForLeague,
  deleteDraftScoped,
  findLiveDraftForYear,
  listLeagueDrafts,
} from '@/server/db/draft-scope-queries';
import {
  getSleeperDraftPoolPreview,
  setDraftPlayerPoolType,
  syncSleeperDraftPlayerPool,
} from '@/server/db/draft-player-pool-queries';
import { setDraftOrderType } from '@/server/db/draft-setup-queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!(await getUnderlyingPlatformAdminUserFromRequest(req))) return NextResponse.json({ error: 'Platform admin required' }, { status: 403 });
  const leagues = await getAllLeagues();
  const drafts = await Promise.all(leagues.map(async (league) => ({ leagueId: league.id, drafts: await listLeagueDrafts(league.id, true) })));
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
    const rounds = Math.max(1, Math.min(40, Number(body.rounds || 4)));
    const clockSeconds = Math.max(10, Math.min(86400, Number(body.clockSeconds || 60)));
    const playerPoolType = normalizeDraftPlayerPoolType(body.playerPoolType);
    if (await findLiveDraftForYear(leagueId, year)) return NextResponse.json({ error: `A live ${year} draft already exists for this league.` }, { status: 409 });
    const teams = await getLeagueTeamOptions(leagueId);
    if (teams.length === 0) return NextResponse.json({ error: 'No league teams are available. Finish team/provider setup first.' }, { status: 400 });

    let preparedPool: Awaited<ReturnType<typeof getSleeperDraftPoolPreview>> | undefined;
    if (playerPoolType !== 'custom') {
      try {
        preparedPool = await getSleeperDraftPoolPreview(year, playerPoolType);
        if (playerPoolType === 'all_players' && preparedPool.players.length === 0) {
          return NextResponse.json({ error: 'Sleeper returned an empty standard player pool. The draft was not created.' }, { status: 502 });
        }
      } catch (error) {
        console.error('[admin/drafts] Sleeper player pool fetch failed', error);
        return NextResponse.json({ error: 'Sleeper player data is unavailable right now. The draft was not created.' }, { status: 502 });
      }
    }

    const draftId = await createLiveDraftForLeague({ leagueId, year, rounds, teams: teams.map((team) => team.teamName), clockSeconds });
    try {
      await setDraftOrderType(draftId, 'linear');
      const pool = playerPoolType === 'custom'
        ? (await setDraftPlayerPoolType(draftId, 'custom'), { count: 0, defenses: 0, rookies: 0, usesLiveSleeperPool: false })
        : await syncSleeperDraftPlayerPool(draftId, year, playerPoolType, preparedPool);
      const warning = playerPoolType === 'custom'
        ? 'Custom draft created. Import the custom player list in the league commissioner Draft Setup before starting it.'
        : playerPoolType !== 'all_players' && pool.count === 0
          ? `Sleeper does not currently list any eligible ${year} players for this pool. Refresh the pool before the draft starts.`
          : playerPoolType === 'rookies_plus_defenses' && pool.defenses !== 32
            ? `Sleeper returned ${pool.defenses} team defenses instead of 32. Review the pool before starting.`
            : null;
      const res = NextResponse.json({ ok: true, draftId, pool, warning });
      res.cookies.set('active_league_id', leagueId, { httpOnly: false, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 });
      res.cookies.set('lz_admin_draft_id', draftId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 });
      return res;
    } catch (error) {
      await deleteDraftScoped(draftId).catch(() => {});
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Draft setup failed.' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
