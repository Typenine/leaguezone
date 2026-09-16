import AllLeaguePage from '@/app/history/all-league/page';
import ProviderHistorySection from '@/components/providers/ProviderHistorySection';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { listLeagueProviderSeasons } from '@/lib/server/provider-seasons';

export const dynamic = 'force-dynamic';
export default async function ScopedAllLeaguePage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  const league = await getLeagueBySlug(leagueSlug);
  const seasons = league ? await listLeagueProviderSeasons(league.id).catch(() => []) : [];
  if (league && seasons.some((row) => row.provider === 'yahoo')) return <ProviderHistorySection leagueId={league.id} leagueSlug={league.slug} mode="all-league" />;
  return AllLeaguePage({ searchParams: Promise.resolve({ _league: leagueSlug }) });
}
