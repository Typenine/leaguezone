import TeamsDirectory from '@/components/league/TeamsDirectory';

export const dynamic = 'force-dynamic';

export default async function LeagueTeamsPage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  return <TeamsDirectory leagueSlug={leagueSlug} />;
}
