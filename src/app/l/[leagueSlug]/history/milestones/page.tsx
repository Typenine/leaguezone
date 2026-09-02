import MilestonesPage from '@/app/history/milestones/page';
export const dynamic = 'force-dynamic';
export default async function ScopedMilestonesPage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  return MilestonesPage({ searchParams: Promise.resolve({ _league: leagueSlug }) });
}
