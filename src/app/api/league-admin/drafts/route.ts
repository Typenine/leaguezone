import { NextRequest, NextResponse } from 'next/server';
import { isAdminCookieValue } from '@/lib/auth/admin';
import { normalizeDraftPlayerPoolType } from '@/lib/draft/player-pool';
import {
  buildDraftRoundOrders,
  normalizeDraftOrderType,
  type DraftOrderType,
} from '@/lib/draft/draft-order';
import {
  normalizeCustomDraftPlayersInput,
  validateCustomDraftPlayers,
} from '@/lib/draft/custom-player-pool';
import { getUnderlyingPlatformAdminUserFromRequest } from '@/lib/server/admin-auth';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { getActiveLeagueMembership } from '@/lib/server/membership';
import { getLeagueTeamOptions } from '@/lib/server/league-teams';
import {
  archiveLiveDraft,
  createLiveDraftForLeague,
  deleteDraftScoped,
  findLiveDraftForYear,
  listLeagueDrafts,
} from '@/server/db/draft-scope-queries';
import {
  getDraftPlayerPoolConfig,
  getSleeperDraftPoolPreview,
  replaceCustomDraftPlayerPool,
  syncSleeperDraftPlayerPool,
} from '@/server/db/draft-player-pool-queries';
import { getDraftOrderType, setDraftOrderType } from '@/server/db/draft-setup-queries';
import { setDraftSlots } from '@/server/db/queries.fixed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getManageableLeague(req: NextRequest, slug: string) {
  const league = slug ? await getLeagueBySlug(slug) : null;
  if (!league) return null;

  if (isAdminCookieValue(req.cookies.get('evw_admin')?.value)) return league;
  if (await getUnderlyingPlatformAdminUserFromRequest(req)) return league;

  const membership = await getActiveLeagueMembership(league.id);
  return membership.ok && membership.membership.isCommissioner ? league : null;
}

async function draftPayload(leagueId: string) {
  const drafts = await listLeagueDrafts(leagueId, false);
  return Promise.all(drafts.map(async (draft) => ({
    ...draft,
    playerPool: await getDraftPlayerPoolConfig(draft.id),
    draftOrderType: await getDraftOrderType(draft.id),
  })));
}

function setDraftCookies(res: NextResponse, leagueId: string, draftId: string) {
  const secure = process.env.NODE_ENV === 'production';
  res.cookies.set('active_league_id', leagueId, {
    httpOnly: false,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  res.cookies.set('lz_admin_draft_id', draftId, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

function readCustomRoundOrders(value: unknown): Record<number, string[]> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const result: Record<number, string[]> = {};
  for (const [key, order] of Object.entries(value as Record<string, unknown>)) {
    const round = Number(key);
    if (!Number.isInteger(round) || round < 1 || !Array.isArray(order)) continue;
    result[round] = order.map((team) => String(team));
  }
  return result;
}

function orderSlots(roundOrders: Record<number, string[]>): Array<{ overall: number; team: string }> {
  const slots: Array<{ overall: number; team: string }> = [];
  let overall = 1;
  for (const round of Object.keys(roundOrders).map(Number).sort((a, b) => a - b)) {
    for (const team of roundOrders[round]) {
      slots.push({ overall, team });
      overall += 1;
    }
  }
  return slots;
}

function poolWarning(poolType: string, year: number, pool: { count: number; defenses: number }): string | null {
  if (poolType !== 'all_players' && poolType !== 'custom' && pool.count === 0) {
    return `Sleeper does not currently list any eligible ${year} players for this pool. Refresh it before the draft starts.`;
  }
  if (poolType === 'rookies_plus_defenses' && pool.defenses !== 32) {
    return `Sleeper currently returned ${pool.defenses} team defenses instead of the expected 32. Review the pool before starting the draft.`;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('league')?.trim() || '';
  const league = await getManageableLeague(req, slug);
  if (!league) return NextResponse.json({ error: 'Commissioner access required' }, { status: 403 });

  const teams = await getLeagueTeamOptions(league.id);
  return NextResponse.json({
    league: { id: league.id, slug: league.slug, name: league.name },
    teams,
    drafts: await draftPayload(league.id),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const slug = typeof body.league === 'string' ? body.league.trim() : '';
  const league = await getManageableLeague(req, slug);
  if (!league) return NextResponse.json({ error: 'Commissioner access required' }, { status: 403 });

  const action = typeof body.action === 'string' ? body.action : '';

  if (action === 'create') {
    const year = Math.max(2000, Math.min(2200, Number(body.year || new Date().getFullYear() + 1)));
    const rounds = Math.max(1, Math.min(40, Number(body.rounds || 4)));
    const clockSeconds = Math.max(10, Math.min(86400, Number(body.clockSeconds || 60)));
    const playerPoolType = normalizeDraftPlayerPoolType(body.playerPoolType);
    const draftOrderType = normalizeDraftOrderType(body.draftOrderType);

    if (await findLiveDraftForYear(league.id, year)) {
      return NextResponse.json({ error: `A live ${year} draft already exists for this league.` }, { status: 409 });
    }

    const teams = await getLeagueTeamOptions(league.id);
    if (teams.length === 0) {
      return NextResponse.json({ error: 'No league teams are available. Finish team/provider setup first.' }, { status: 400 });
    }
    const teamNames = teams.map((team) => team.teamName);

    let roundOrders: Record<number, string[]>;
    try {
      roundOrders = buildDraftRoundOrders(teamNames, rounds, draftOrderType, readCustomRoundOrders(body.roundOrders));
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid draft order.' }, { status: 400 });
    }

    const customPlayers = playerPoolType === 'custom' ? normalizeCustomDraftPlayersInput(body.customPlayers) : [];
    if (playerPoolType === 'custom') {
      const customError = validateCustomDraftPlayers(customPlayers);
      if (customError) return NextResponse.json({ error: customError }, { status: 400 });
    }

    let preparedPool: Awaited<ReturnType<typeof getSleeperDraftPoolPreview>> | undefined;
    if (playerPoolType !== 'custom') {
      try {
        preparedPool = await getSleeperDraftPoolPreview(year, playerPoolType);
        if (playerPoolType === 'all_players' && preparedPool.players.length === 0) {
          return NextResponse.json({ error: 'Sleeper returned an empty standard player pool. The draft was not created.' }, { status: 502 });
        }
      } catch (error) {
        console.error('[league-admin/drafts] Sleeper player pool fetch failed', error);
        return NextResponse.json({
          error: 'Sleeper player data is unavailable right now. The draft was not created, so no incomplete setup was saved.',
        }, { status: 502 });
      }
    }

    const draftId = await createLiveDraftForLeague({
      leagueId: league.id,
      year,
      rounds,
      teams: teamNames,
      clockSeconds,
      roundOrders,
    });

    try {
      await setDraftOrderType(draftId, draftOrderType);
      const pool = playerPoolType === 'custom'
        ? await replaceCustomDraftPlayerPool(draftId, customPlayers)
        : await syncSleeperDraftPlayerPool(draftId, year, playerPoolType, preparedPool);
      const res = NextResponse.json({
        ok: true,
        draftId,
        pool,
        warning: poolWarning(playerPoolType, year, pool),
      });
      setDraftCookies(res, league.id, draftId);
      return res;
    } catch (error) {
      await deleteDraftScoped(draftId).catch(() => {});
      console.error('[league-admin/drafts] Draft setup failed after creation', error);
      return NextResponse.json({ error: 'Draft setup failed and the incomplete draft was removed.' }, { status: 500 });
    }
  }

  const draftId = typeof body.draftId === 'string' ? body.draftId : '';
  const drafts = await listLeagueDrafts(league.id, false);
  const draft = drafts.find((item) => item.id === draftId);
  if (!draft) return NextResponse.json({ error: 'Draft not found for this league' }, { status: 404 });

  if (action === 'select') {
    if (draft.archivedAt) return NextResponse.json({ error: 'Archived drafts cannot be selected for live management' }, { status: 400 });
    const res = NextResponse.json({ ok: true });
    setDraftCookies(res, league.id, draft.id);
    return res;
  }

  if (action === 'sync_player_pool') {
    if (draft.status !== 'NOT_STARTED') {
      return NextResponse.json({ error: 'Player-pool rules are locked once a draft has started.' }, { status: 409 });
    }
    const playerPoolType = normalizeDraftPlayerPoolType(body.playerPoolType ?? (await getDraftPlayerPoolConfig(draft.id)).type);
    if (playerPoolType === 'custom') {
      return NextResponse.json({ error: 'Import a CSV or JSON file to update a custom player pool.' }, { status: 400 });
    }
    try {
      const pool = await syncSleeperDraftPlayerPool(draft.id, draft.year, playerPoolType);
      return NextResponse.json({ ok: true, pool, warning: poolWarning(playerPoolType, draft.year, pool) });
    } catch (error) {
      console.error('[league-admin/drafts] Sleeper player pool refresh failed', error);
      return NextResponse.json({ error: 'Could not refresh the Sleeper player pool.' }, { status: 502 });
    }
  }

  if (action === 'replace_custom_pool') {
    if (draft.status !== 'NOT_STARTED') {
      return NextResponse.json({ error: 'Player-pool rules are locked once a draft has started.' }, { status: 409 });
    }
    const players = normalizeCustomDraftPlayersInput(body.customPlayers);
    const customError = validateCustomDraftPlayers(players);
    if (customError) return NextResponse.json({ error: customError }, { status: 400 });
    const pool = await replaceCustomDraftPlayerPool(draft.id, players);
    return NextResponse.json({ ok: true, pool });
  }

  if (action === 'update_order') {
    if (draft.status !== 'NOT_STARTED') {
      return NextResponse.json({ error: 'Draft order is locked once a draft has started.' }, { status: 409 });
    }
    const teams = await getLeagueTeamOptions(league.id);
    const teamNames = teams.map((team) => team.teamName);
    const draftOrderType = normalizeDraftOrderType(body.draftOrderType) as DraftOrderType;
    try {
      const roundOrders = buildDraftRoundOrders(teamNames, draft.rounds, draftOrderType, readCustomRoundOrders(body.roundOrders));
      await setDraftSlots(draft.id, orderSlots(roundOrders), false);
      await setDraftOrderType(draft.id, draftOrderType);
      return NextResponse.json({ ok: true });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid draft order.' }, { status: 400 });
    }
  }

  if (action === 'archive') {
    try {
      await archiveLiveDraft(draft.id, league.id);
      return NextResponse.json({ ok: true });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Archive failed' }, { status: 400 });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
