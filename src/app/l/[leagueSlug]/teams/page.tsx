import TeamsPage from '@/app/teams/page';

export const dynamic = 'force-dynamic';

export default async function LeagueTeamsPage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  return <TeamsPage leagueSlug={leagueSlug} />;
}
