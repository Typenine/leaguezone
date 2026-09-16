import MilestonesPage from '@/app/history/milestones/page';
import ProviderHistorySection from '@/components/providers/ProviderHistorySection';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { listLeagueProviderSeasons } from '@/lib/server/provider-seasons';

export const dynamic = 'force-dynamic';
export default async function ScopedMilestonesPage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  const league = await getLeagueBySlug(leagueSlug);
  const seasons = league ? await listLeagueProviderSeasons(league.id).catch(() => []) : [];
  if (league && seasons.some((row) => row.provider === 'yahoo')) return <ProviderHistorySection leagueId={league.id} leagueSlug={league.slug} mode="milestones" />;
  return MilestonesPage({ searchParams: Promise.resolve({ _league: leagueSlug }) });
}
