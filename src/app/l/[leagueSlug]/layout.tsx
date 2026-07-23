import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getCurrentLeagueBySlug, getLeagueFeatures } from '@/lib/server/league-context';
import { LEAGUE_NAV, leagueUrl } from '@/lib/config/platform';
import LeagueNav from '@/components/league/LeagueNav';
import LeagueRuntimeSync from '@/components/league/LeagueRuntimeSync';
import { verifySession } from '@/lib/server/auth';
import { isAdminCookieValue, isSiteAdminCookieValue } from '@/lib/auth/admin';
import { getUserLeagues } from '@/lib/server/user-auth';

export const dynamic = 'force-dynamic';

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export default async function LeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ leagueSlug: string }>;
}) {
  const { leagueSlug } = await params;
  const league = await getCurrentLeagueBySlug(leagueSlug);
  if (!league) notFound();

  const jar = await cookies();
  const token = jar.get('evw_session')?.value || '';
  const claims = token ? verifySession(token) : null;
  const cookieAdmin = isAdminCookieValue(jar.get('evw_admin')?.value)
    || isSiteAdminCookieValue(jar.get('site_admin')?.value);

  let membership: Awaited<ReturnType<typeof getUserLeagues>>[number] | null = null;
  if (claims?.type === 'user' && typeof claims.sub === 'string') {
    const memberships = await getUserLeagues(claims.sub);
    membership = memberships.find((item) => item.leagueId === league.id) || null;
  }

  const canOpenDashboard = cookieAdmin || Boolean(membership);
  const canAdmin = cookieAdmin || Boolean(membership?.isCommissioner);
  const features = getLeagueFeatures(league);
  const accent = league.primaryColor || 'var(--brand-blue)';
  const secondary = league.secondaryColor || 'var(--brand-gold)';

  const navLinks = LEAGUE_NAV
    .filter((item) => (!item.feature || features[item.feature]) && (!item.adminOnly || canAdmin))
    .map((item) => ({ href: leagueUrl(league.slug, item.segment), label: item.label }));

  const allLeagueIds = league.sleeperLeagueIds || {};
  const currentSeason = Object.entries(allLeagueIds)
    .find(([, id]) => id === league.sleeperLeagueId)?.[0] || '';
  const previousLeagueIds = Object.fromEntries(
    Object.entries(allLeagueIds).filter(([, id]) => id !== league.sleeperLeagueId),
  );
  const runtimeConfigValue = {
    currentLeagueId: league.sleeperLeagueId || '',
    currentSeason,
    previousLeagueIds,
  };
  const runtimeBrandingValue = {
    name: league.name,
    shortName: league.shortName,
    logoUrl: league.logoUrl,
    primaryColor: league.primaryColor,
    secondaryColor: league.secondaryColor,
  };
  const runtimeConfig = safeJson(runtimeConfigValue);
  const runtimeBranding = safeJson(runtimeBrandingValue);
  const dashboardHref = `/api/league/select?id=${encodeURIComponent(league.id)}&next=${encodeURIComponent('/home')}`;
  const adminHref = `/api/league/select?id=${encodeURIComponent(league.id)}&next=${encodeURIComponent('/settings')}`;

  return (
    <div
      className="flex min-h-full flex-col"
      style={{
        '--accent': accent,
        '--focus': accent,
        '--gold': secondary,
        '--league-accent': accent,
        '--league-secondary': secondary,
      } as React.CSSProperties}
    >
      <LeagueRuntimeSync leagueId={league.id} config={runtimeConfigValue} branding={runtimeBrandingValue} />
      <script
        dangerouslySetInnerHTML={{
          __html: `(() => { window.__LEAGUE_CONFIG__ = ${runtimeConfig}; window.__LEAGUE_BRANDING__ = ${runtimeBranding}; document.cookie = 'active_league_id=${encodeURIComponent(league.id)}; Path=/; Max-Age=2592000; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : ''); window.dispatchEvent(new Event('leaguezone:league-changed')); })();`,
        }}
      />
      <header style={{ background: 'var(--brand-navy)', boxShadow: `inset 0 -3px 0 ${accent}`, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between gap-3 py-3">
            <Link href={leagueUrl(league.slug)} className="flex min-w-0 items-center gap-3" aria-label={`${league.name} league site home`}>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10" style={{ backgroundColor: `color-mix(in srgb, ${accent} 18%, #0a1c48)` }}>
                {league.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={league.logoUrl} alt={league.name} className="h-full w-full object-contain" />
                ) : (
                  <span className="text-sm font-black" style={{ color: accent }}>{initials(league.name)}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-black leading-tight text-white">{league.name}</p>
                <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                  {league.shortName || 'League Site'}{league.foundedYear ? ` · Est. ${league.foundedYear}` : ''}
                </p>
              </div>
            </Link>
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              {canOpenDashboard && <a href={dashboardHref} className="rounded-full border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/60 transition hover:border-white/30 hover:text-white">League Dashboard</a>}
              {canAdmin && <a href={adminHref} className="rounded-full border border-[var(--gold)]/40 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--gold)] transition hover:bg-white/5">Commissioner Settings</a>}
            </div>
          </div>
        </div>
        <LeagueNav links={navLinks} accent={league.primaryColor} />
      </header>
      <div className="flex-grow">{children}</div>
    </div>
  );
}
