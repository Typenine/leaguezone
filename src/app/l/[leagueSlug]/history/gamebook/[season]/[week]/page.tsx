import GamebookWeekPage from '@/app/history/gamebook/[season]/[week]/page';
import ProviderHistorySection from '@/components/providers/ProviderHistorySection';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { listLeagueProviderSeasons } from '@/lib/server/provider-seasons';

export const dynamic = 'force-dynamic';
export default async function ScopedGamebookWeekPage({ params }: { params: Promise<{ leagueSlug: string; season: string; week: string }> }) {
  const values = await params;
  const league = await getLeagueBySlug(values.leagueSlug);
  const seasons = league ? await listLeagueProviderSeasons(league.id).catch(() => []) : [];
  const selected = seasons.find((row) => row.season === Number(values.season));
  if (league && selected?.provider === 'yahoo') return <ProviderHistorySection leagueId={league.id} leagueSlug={league.slug} mode="gamebook-week" season={Number(values.season)} week={Number(values.week)} />;
  return GamebookWeekPage({ params: Promise.resolve({ season: values.season, week: values.week }), searchParams: Promise.resolve({ _league: values.leagueSlug }) });
}
