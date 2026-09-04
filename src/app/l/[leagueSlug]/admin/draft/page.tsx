import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import LeagueDraftCommissionerConsole from '@/components/admin/LeagueDraftCommissionerConsole';
import { getCurrentLeagueBySlug } from '@/lib/server/league-context';
import { verifySession } from '@/lib/server/auth';
import { isAdminCookieValue, isSiteAdminCookieValue } from '@/lib/auth/admin';
import { isUnderlyingPlatformAdminSession } from '@/lib/server/admin-auth';
import { getUserLeagues } from '@/lib/server/user-auth';

export const dynamic = 'force-dynamic';

export default async function LeagueDraftCommissionerPage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  const league = await getCurrentLeagueBySlug(leagueSlug);
  if (!league) redirect('/');

  const jar = await cookies();
  let authorized = isAdminCookieValue(jar.get('evw_admin')?.value)
    || isSiteAdminCookieValue(jar.get('site_admin')?.value)
    || await isUnderlyingPlatformAdminSession();
  const token = jar.get('evw_session')?.value || '';
  const claims = token ? verifySession(token) : null;

  if (!authorized && claims?.type === 'user' && typeof claims.sub === 'string') {
    const memberships = await getUserLeagues(claims.sub);
    authorized = Boolean(memberships.find((membership) => membership.leagueId === league.id)?.isCommissioner);
  }

  if (!authorized) redirect(`/l/${encodeURIComponent(league.slug)}`);
  return <LeagueDraftCommissionerConsole leagueSlug={league.slug} />;
}
