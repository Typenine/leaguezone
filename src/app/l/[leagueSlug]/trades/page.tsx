import { notFound } from 'next/navigation';
import TradesPage from '@/app/trades/page';
import { getLeagueBySlug } from '@/lib/server/league-context';

export const dynamic = 'force-dynamic';

export default async function LeagueTradesPage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) notFound();
  return <TradesPage />;
}
