import { Suspense } from 'react';
import HistoryContent from '@/app/history/HistoryContent';
import LeagueShareCardLink from '@/components/branding/LeagueShareCardLink';
import ProviderHistory from '@/components/providers/ProviderHistory';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { listLeagueProviderSeasons } from '@/lib/server/provider-seasons';

export const dynamic = 'force-dynamic';

export default async function LeagueHistoryPage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  const league = await getLeagueBySlug(leagueSlug);
  const seasons = league ? await listLeagueProviderSeasons(league.id).catch(() => []) : [];
  const hasYahooHistory = seasons.some((row) => row.provider === 'yahoo');
  return (
    <>
      <div className="container mx-auto flex justify-end px-4 pt-6"><LeagueShareCardLink leagueSlug={leagueSlug} type="record" title="League Record Book" /></div>
      {league && hasYahooHistory ? (
        <ProviderHistory leagueId={league.id} leagueSlug={league.slug} />
      ) : (
        <Suspense fallback={<div className="container mx-auto px-4 py-8">Loading...</div>}><HistoryContent /></Suspense>
      )}
    </>
  );
}
