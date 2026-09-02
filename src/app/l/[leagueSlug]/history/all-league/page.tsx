import AllLeaguePage from '@/app/history/all-league/page';
export const dynamic = 'force-dynamic';
export default async function ScopedAllLeaguePage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  return AllLeaguePage({ searchParams: Promise.resolve({ _league: leagueSlug }) });
}
