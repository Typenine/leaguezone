import RostersPage from '@/app/rosters/page';

export const dynamic = 'force-dynamic';

export default async function LeagueRostersPage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  return <RostersPage teamBasePath={`/l/${leagueSlug}/teams`} playerBasePath={`/l/${leagueSlug}/players`} />;
}
