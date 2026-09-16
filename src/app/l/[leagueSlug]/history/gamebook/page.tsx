import GamebookPage from '@/app/history/gamebook/page';
import ProviderHistorySection from '@/components/providers/ProviderHistorySection';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { listLeagueProviderSeasons } from '@/lib/server/provider-seasons';

export const dynamic = 'force-dynamic';
export default async function ScopedGamebookPage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  const league = await getLeagueBySlug(leagueSlug);
  const seasons = league ? await listLeagueProviderSeasons(league.id).catch(() => []) : [];
  if (league && seasons.some((row) => row.provider === 'yahoo')) return <ProviderHistorySection leagueId={league.id} leagueSlug={league.slug} mode="gamebook" />;
  return GamebookPage({ searchParams: Promise.resolve({ _league: leagueSlug }) });
}
