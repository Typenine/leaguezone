import { notFound } from 'next/navigation';
import TradesPage from '@/app/trades/page';
import ProviderTrades from '@/components/providers/ProviderTrades';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { resolveLeagueProviderSeason } from '@/lib/server/provider-seasons';

export const dynamic = 'force-dynamic';

export default async function LeagueTradesPage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) notFound();
  const current = await resolveLeagueProviderSeason(league.id).catch(() => null);
  if (current?.provider === 'yahoo') return <ProviderTrades leagueId={league.id} />;
  return <TradesPage />;
}
