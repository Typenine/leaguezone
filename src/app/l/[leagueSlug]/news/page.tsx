import AroundTheLeague from '@/components/home/AroundTheLeague';

export const dynamic = 'force-dynamic';

export default async function LeagueNewsPage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  return <main className="container mx-auto px-4 py-8"><AroundTheLeague leagueSlug={leagueSlug} /></main>;
}
