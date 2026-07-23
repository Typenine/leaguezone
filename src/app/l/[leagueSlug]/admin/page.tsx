import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import SettingsPage from '@/app/settings/page';
import { getCurrentLeagueBySlug } from '@/lib/server/league-context';
import { verifySession } from '@/lib/server/auth';
import { isAdminCookieValue, isSiteAdminCookieValue } from '@/lib/auth/admin';
import { getUserLeagues } from '@/lib/server/user-auth';

export const dynamic = 'force-dynamic';

export default async function LeagueAdminPage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  const league = await getCurrentLeagueBySlug(leagueSlug);
  if (!league) redirect('/');

  const jar = await cookies();
  let authorized = isAdminCookieValue(jar.get('evw_admin')?.value)
    || isSiteAdminCookieValue(jar.get('site_admin')?.value);
  const token = jar.get('evw_session')?.value || '';
  const claims = token ? verifySession(token) : null;

  if (!authorized && claims?.type === 'user' && typeof claims.sub === 'string') {
    const memberships = await getUserLeagues(claims.sub);
    authorized = Boolean(memberships.find((membership) => membership.leagueId === league.id)?.isCommissioner);
  }

  if (!authorized) redirect(`/l/${encodeURIComponent(league.slug)}`);
  return <SettingsPage />;
}
