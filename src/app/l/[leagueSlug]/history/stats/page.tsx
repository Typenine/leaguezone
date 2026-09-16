import { notFound } from 'next/navigation';
import StatsReferenceRouter from '@/app/history/stats/StatsReferenceRouter';
import ProviderHistorySection from '@/components/providers/ProviderHistorySection';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { listLeagueProviderSeasons } from '@/lib/server/provider-seasons';
import { getLeagueStatsDatasetV3 } from '@/lib/stats/league-stats-v3';
import { buildLeagueStatsContext } from '@/lib/stats/league-stats-context';

export const dynamic = 'force-dynamic';
export default async function LeagueStatsPage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) notFound();
  const seasons = await listLeagueProviderSeasons(league.id).catch(() => []);
  if (seasons.some((row) => row.provider === 'yahoo')) return <ProviderHistorySection leagueId={league.id} leagueSlug={league.slug} mode="stats" />;
  const context = await buildLeagueStatsContext(league);
  if (!context) notFound();
  const dataset = await getLeagueStatsDatasetV3(context);
  return <StatsReferenceRouter dataset={dataset} />;
}
