import { notFound } from 'next/navigation';
import TradeAnalyzerPage from '@/app/trades/analyzer/page';
import { getLeagueBySlug } from '@/lib/server/league-context';

export const dynamic = 'force-dynamic';

export default async function LeagueTradeAnalyzerPage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) notFound();
  return <TradeAnalyzerPage />;
}
