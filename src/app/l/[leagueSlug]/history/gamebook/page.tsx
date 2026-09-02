import GamebookPage from '@/app/history/gamebook/page';
export const dynamic = 'force-dynamic';
export default async function ScopedGamebookPage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  return GamebookPage({ searchParams: Promise.resolve({ _league: leagueSlug }) });
}
