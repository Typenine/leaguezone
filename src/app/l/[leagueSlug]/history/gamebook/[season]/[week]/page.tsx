import GamebookWeekPage from '@/app/history/gamebook/[season]/[week]/page';
export const dynamic = 'force-dynamic';
export default async function ScopedGamebookWeekPage({ params }: { params: Promise<{ leagueSlug: string; season: string; week: string }> }) {
  const values = await params;
  return GamebookWeekPage({ params: Promise.resolve({ season: values.season, week: values.week }), searchParams: Promise.resolve({ _league: values.leagueSlug }) });
}
