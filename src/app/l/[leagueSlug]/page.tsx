import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import SeasonLaunchHome from '@/components/home/SeasonLaunchHome';
import { verifySession } from '@/lib/server/auth';
import { getCurrentLeagueBySlug } from '@/lib/server/league-context';
import { getUserLeagues } from '@/lib/server/user-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function LeagueHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ leagueSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { leagueSlug } = await params;
  const league = await getCurrentLeagueBySlug(leagueSlug);
  if (!league) notFound();

  const cookieJar = await cookies();
  const sessionToken = cookieJar.get('evw_session')?.value || '';
  const claims = sessionToken ? verifySession(sessionToken) : null;
  const userId = claims?.type === 'user' && typeof claims.sub === 'string' ? claims.sub : null;
  const userLeagues = userId ? await getUserLeagues(userId) : [];
  const membership = userLeagues.find((item) => item.leagueId === league.id) ?? null;

  return (
    <SeasonLaunchHome
      league={league}
      teamName={membership?.teamName ?? null}
      rosterId={membership?.rosterId ?? null}
      searchParams={searchParams}
      showCountdowns={false}
      weekNavigationHref={`/l/${league.slug}`}
    />
  );
}
