import { notFound } from 'next/navigation';
import TradeAnalyzerPage from '@/app/trades/analyzer/page';
import LeagueTradeAnalyzerFormatLabel from '@/components/trades/LeagueTradeAnalyzerFormatLabel';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { resolveTradeAnalyzerLeagueFormat } from '@/lib/trades/trade-analyzer-format';

export const dynamic = 'force-dynamic';

export default async function LeagueTradeAnalyzerPage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) notFound();
  const format = await resolveTradeAnalyzerLeagueFormat(league);
  return <div id="league-trade-analyzer"><LeagueTradeAnalyzerFormatLabel label={format.label} /><TradeAnalyzerPage /></div>;
}
