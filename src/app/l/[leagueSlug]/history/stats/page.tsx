import { notFound } from 'next/navigation';
import StatsReferenceRouter from '@/app/history/stats/StatsReferenceRouter';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { getLeagueStatsDatasetV3 } from '@/lib/stats/league-stats-v3';
import { buildLeagueStatsContext } from '@/lib/stats/league-stats-context';
export const dynamic = 'force-dynamic';
export default async function LeagueStatsPage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) notFound();
  const context = await buildLeagueStatsContext(league);
  if (!context) notFound();
  const dataset = await getLeagueStatsDatasetV3(context);
  return <StatsReferenceRouter dataset={dataset} />;
}
