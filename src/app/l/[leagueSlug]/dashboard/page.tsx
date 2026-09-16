import { notFound, redirect } from 'next/navigation';
import SeasonLaunchHome from '@/components/home/SeasonLaunchHome';
import ProviderSeasonHome from '@/components/home/ProviderSeasonHome';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { getActiveLeagueMembership } from '@/lib/server/membership';
import { resolveLeagueProviderSeason } from '@/lib/server/provider-seasons';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function LeagueDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ leagueSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { leagueSlug } = await params;
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) notFound();

  const result = await getActiveLeagueMembership(league.id);
  if (!result.ok) redirect(`/login?next=${encodeURIComponent(`/l/${league.slug}/dashboard`)}`);

  const currentProvider = await resolveLeagueProviderSeason(league.id).catch(() => null);
  if (currentProvider?.provider === 'yahoo') {
    return (
      <ProviderSeasonHome
        league={league}
        teamName={result.membership.teamName}
        rosterId={result.membership.rosterId}
        searchParams={searchParams}
      />
    );
  }

  return (
    <SeasonLaunchHome
      league={league}
      teamName={result.membership.teamName}
      rosterId={result.membership.rosterId}
      searchParams={searchParams}
    />
  );
}
