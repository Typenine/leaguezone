import { getCurrentLeague } from '@/lib/server/league-context';
import { DRAFT_PLAYER_POOL_OPTIONS } from '@/lib/draft/player-pool';
import { DRAFT_ORDER_OPTIONS } from '@/lib/draft/draft-order';
import { getActiveOrLatestDraftId, getDraftOverview } from '@/server/db/queries';
import { getDraftPlayerPoolConfig } from '@/server/db/draft-player-pool-queries';
import { getDraftOrderType } from '@/server/db/draft-setup-queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const league = await getCurrentLeague();
  if (!league) return Response.json({ league: null, draft: null, lifecycle: null });

  const lifecycle = (league.config.draftLifecycle || {}) as Record<string, unknown>;
  const dates = (league.config.importantDates || {}) as Record<string, unknown>;
  const draftId = await getActiveOrLatestDraftId().catch(() => null);
  if (!draftId) {
    return Response.json({
      league: { id: league.id, slug: league.slug, name: league.name },
      draft: null,
      lifecycle: {
        state: typeof lifecycle.state === 'string' ? lifecycle.state : 'scheduled',
        date: typeof lifecycle.date === 'string' ? lifecycle.date : (typeof dates.nextDraft === 'string' ? dates.nextDraft : null),
        location: typeof lifecycle.location === 'string' ? lifecycle.location : '',
      },
    });
  }

  const overview = await getDraftOverview(draftId).catch(() => null);
  if (!overview) {
    return Response.json({
      league: { id: league.id, slug: league.slug, name: league.name },
      draft: null,
      lifecycle: {
        state: typeof lifecycle.state === 'string' ? lifecycle.state : 'scheduled',
        date: typeof lifecycle.date === 'string' ? lifecycle.date : (typeof dates.nextDraft === 'string' ? dates.nextDraft : null),
        location: typeof lifecycle.location === 'string' ? lifecycle.location : '',
      },
    });
  }

  const [pool, orderType] = await Promise.all([
    getDraftPlayerPoolConfig(draftId).catch(() => null),
    getDraftOrderType(draftId).catch(() => 'linear' as const),
  ]);
  const poolLabel = pool
    ? DRAFT_PLAYER_POOL_OPTIONS.find((option) => option.value === pool.type)?.label || 'Draft player pool'
    : 'Draft player pool';
  const orderLabel = DRAFT_ORDER_OPTIONS.find((option) => option.value === orderType)?.label || 'Draft order';

  return Response.json({
    league: { id: league.id, slug: league.slug, name: league.name },
    lifecycle: {
      state: typeof lifecycle.state === 'string' ? lifecycle.state : 'scheduled',
      date: typeof lifecycle.date === 'string' ? lifecycle.date : (typeof dates.nextDraft === 'string' ? dates.nextDraft : null),
      location: typeof lifecycle.location === 'string' ? lifecycle.location : '',
    },
    draft: {
      id: overview.id,
      year: overview.year,
      rounds: overview.rounds,
      clockSeconds: overview.clockSeconds,
      status: overview.status,
      eventName: overview.eventName || null,
      playerPoolType: pool?.type || null,
      playerPoolLabel: poolLabel,
      draftOrderType: orderType,
      draftOrderLabel: orderLabel,
      slots: (overview.allSlots || []).map((slot) => ({ overall: slot.overall, round: slot.round, team: slot.team })),
    },
  });
}
