import { NextRequest } from 'next/server';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { guardPublicDataRequest } from '@/lib/server/public-api-guard';
import { readThroughReliabilityCache, reliabilityKey, reliabilityResponseHeaders } from '@/lib/server/reliability-cache';
import { buildTransactionLedger } from '@/lib/utils/transactions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const guarded = await guardPublicDataRequest(request, {
    action: 'recent-transactions',
    requireBrowserGate: true,
    limit: { maxRequests: 60, windowSeconds: 5 * 60 },
  });
  if (guarded) return guarded;

  const slug = request.nextUrl.searchParams.get('league')?.trim().toLowerCase();
  if (!slug) return Response.json({ error: 'league is required' }, { status: 400 });
  const league = await getLeagueBySlug(slug);
  if (!league) return Response.json({ error: 'League not found' }, { status: 404 });
  try {
    const result = await readThroughReliabilityCache({
      key: reliabilityKey('recent-transactions', league.id),
      freshForSeconds: 60,
      staleForSeconds: 7 * 24 * 60 * 60,
      load: async () => {
        const ledger = await buildTransactionLedger({ dbLeagueId: league.id });
        return ledger.slice(0, 8).map((item) => ({
          id: item.id,
          type: item.type,
          team: item.team,
          week: item.week,
          created: item.created,
          faab: item.faab,
          added: item.added.map((player) => player.name || player.playerId),
          dropped: item.dropped.map((player) => player.name || player.playerId),
        }));
      },
    });
    return Response.json({ items: result.value }, { headers: reliabilityResponseHeaders(result) });
  } catch {
    return Response.json({ error: 'Recent transactions are temporarily unavailable.' }, { status: 503, headers: { 'Retry-After': '60' } });
  }
}
