import FranchisePage from '@/app/history/franchises/[id]/page';
import ProviderHistorySection from '@/components/providers/ProviderHistorySection';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { listLeagueProviderSeasons } from '@/lib/server/provider-seasons';

export const dynamic = 'force-dynamic';
export default async function ScopedFranchisePage({ params }: { params: Promise<{ leagueSlug: string; id: string }> }) {
  const values = await params;
  const league = await getLeagueBySlug(values.leagueSlug);
  const seasons = league ? await listLeagueProviderSeasons(league.id).catch(() => []) : [];
  if (league && seasons.some((row) => row.provider === 'yahoo')) return <ProviderHistorySection leagueId={league.id} leagueSlug={league.slug} mode="franchise" franchiseId={decodeURIComponent(values.id)} />;
  return FranchisePage({ params: Promise.resolve({ id: values.id }), searchParams: Promise.resolve({ _league: values.leagueSlug }) });
}
