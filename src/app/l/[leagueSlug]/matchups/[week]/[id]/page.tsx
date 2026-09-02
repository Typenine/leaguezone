import MatchupDetailPage from '@/app/matchups/[week]/[id]/page';

export const dynamic = 'force-dynamic';
export const revalidate = 20;

export default async function LeagueMatchupDetailPage({ params }: { params: Promise<{ leagueSlug: string; week: string; id: string }> }) {
  return <MatchupDetailPage params={params} />;
}
