import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import LeagueQuickActions from '@/components/league/LeagueQuickActions';
import { getCurrentLeagueBySlug, getLeagueFeatures } from '@/lib/server/league-context';
import { verifySession } from '@/lib/server/auth';
import { getUserLeagues } from '@/lib/server/user-auth';
import { leagueUrl } from '@/lib/config/platform';

export const dynamic = 'force-dynamic';

export default async function LeagueToolsPage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  const league = await getCurrentLeagueBySlug(leagueSlug);
  if (!league) notFound();

  const cookieJar = await cookies();
  const token = cookieJar.get('evw_session')?.value || '';
  const claims = token ? verifySession(token) : null;
  const userId = claims?.type === 'user' && typeof claims.sub === 'string' ? claims.sub : null;
  const memberships = userId ? await getUserLeagues(userId) : [];
  const membership = memberships.find((item) => item.leagueId === league.id) ?? null;

  return (
    <main className="container mx-auto px-4 py-7 sm:py-10">
      <Link href={leagueUrl(league.slug)} className="mb-5 inline-block text-sm font-semibold text-[var(--muted)] hover:text-[var(--text)]">League home</Link>
      <LeagueQuickActions slug={league.slug} features={getLeagueFeatures(league)} rosterId={membership?.rosterId} full />
    </main>
  );
}
