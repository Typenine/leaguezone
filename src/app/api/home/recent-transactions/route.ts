import { NextRequest } from 'next/server';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { buildTransactionLedger } from '@/lib/utils/transactions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('league')?.trim().toLowerCase();
  if (!slug) return Response.json({ error: 'league is required' }, { status: 400 });
  const league = await getLeagueBySlug(slug);
  if (!league) return Response.json({ error: 'League not found' }, { status: 404 });
  const ledger = await buildTransactionLedger({ dbLeagueId: league.id }).catch(() => []);
  const items = ledger.slice(0, 8).map((item) => ({
    id: item.id,
    type: item.type,
    team: item.team,
    week: item.week,
    created: item.created,
    faab: item.faab,
    added: item.added.map((player) => player.name || player.playerId),
    dropped: item.dropped.map((player) => player.name || player.playerId),
  }));
  return Response.json({ items }, { headers: { 'Cache-Control': 'private, max-age=60' } });
}
