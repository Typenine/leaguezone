import DraftPage from '@/app/draft/page';
import LeagueShareCardLink from '@/components/branding/LeagueShareCardLink';
import ProviderDraftHistory from '@/components/providers/ProviderDraftHistory';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { listLeagueProviderSeasons } from '@/lib/server/provider-seasons';

export const dynamic = 'force-dynamic';

export default async function LeagueDraftPage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  const league = await getLeagueBySlug(leagueSlug);
  const seasons = league ? await listLeagueProviderSeasons(league.id).catch(() => []) : [];
  const hasYahooHistory = seasons.some((row) => row.provider === 'yahoo');
  return (
    <>
      <div className="container mx-auto flex justify-end px-4 pt-6"><LeagueShareCardLink leagueSlug={leagueSlug} type="draft" title="Draft Update" /></div>
      {league && hasYahooHistory && <ProviderDraftHistory leagueId={league.id} />}
      <DraftPage />
    </>
  );
}
