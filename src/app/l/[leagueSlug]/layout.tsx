import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getCurrentLeagueBySlug, getLeagueFeatures } from '@/lib/server/league-context';
import { getFranchiseNamesByOwnerId } from '@/lib/server/franchise-identities';
import { LEAGUE_NAV, leagueUrl } from '@/lib/config/platform';
import LeagueNav, { type LeagueNavLink } from '@/components/league/LeagueNav';
import LeagueRuntimeSync from '@/components/league/LeagueRuntimeSync';
import LeagueMobileNav from '@/components/league/LeagueMobileNav';
import { verifySession } from '@/lib/server/auth';
import { isAdminCookieValue, isSiteAdminCookieValue } from '@/lib/auth/admin';
import { getUserLeagues } from '@/lib/server/user-auth';
import { deriveSemanticBrandTokens, normalizeBrandPalette, normalizeHexColor } from '@/lib/branding/colors';

export const dynamic = 'force-dynamic';

const LEAGUE_SECTION_SEGMENTS = new Set([
  'teams',
  'standings',
  'matchups',
  'rosters',
  'calendar',
  'rulebook',
  'hall-of-fame',
]);

const STANDALONE_NAV_ORDER = ['history', 'draft', 'trade-block', 'news', 'suggestions', 'admin'] as const;

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host') || 'leaguezone.app';
  const proto = h.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

export async function generateMetadata({ params }: { params: Promise<{ leagueSlug: string }> }): Promise<Metadata> {
  const { leagueSlug } = await params;
  const league = await getCurrentLeagueBySlug(leagueSlug);
  if (!league) return {};
  const origin = await requestOrigin();
  const shareImage = `${origin}/api/share-card/${encodeURIComponent(league.slug)}?type=league&title=${encodeURIComponent(league.name)}`;
  const icon = league.logoUrl || '/assets/LeagueZone HQ Logo.png';
  const description = `${league.name} fantasy league home, standings, teams, history, drafts, transactions, and league content.`;
  return {
    metadataBase: new URL(origin),
    title: { default: league.name, template: `%s | ${league.name}` },
    description,
    applicationName: league.name,
    manifest: `/api/leagues/${encodeURIComponent(league.slug)}/manifest`,
    icons: {
      icon: [{ url: icon }],
      shortcut: icon,
      apple: [{ url: icon }],
    },
    openGraph: {
      type: 'website',
      title: league.name,
      description,
      siteName: league.name,
      url: `/l/${league.slug}`,
      images: [{ url: shareImage, width: 1200, height: 630, alt: `${league.name} on LeagueZone` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: league.name,
      description,
      images: [shareImage],
    },
  };
}

export async function generateViewport({ params }: { params: Promise<{ leagueSlug: string }> }): Promise<Viewport> {
  const { leagueSlug } = await params;
  const league = await getCurrentLeagueBySlug(leagueSlug);
  const primary = normalizeHexColor(league?.primaryColor) || '#08111f';
  return {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    themeColor: primary,
  };
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
  const storedAccent = normalizeHexColor(league.primaryColor);
  const storedSecondary = normalizeHexColor(league.secondaryColor);
  const semantic = deriveSemanticBrandTokens(normalizeBrandPalette({
    primary: storedAccent || '#0b5f98',
    secondary: storedSecondary || '#d4a017',
  }) || { primary: '#0b5f98', secondary: '#d4a017' });
  const accent = semantic.accent;
  const secondary = semantic.secondaryAccent;
  const onAccent = semantic.onAccent;
  const onSecondary = semantic.onSecondaryAccent;

  const visibleNavItems = LEAGUE_NAV.filter(
    (item) => (!item.feature || features[item.feature]) && (!item.adminOnly || canAdmin),
  );

  const toNavLink = (item: (typeof LEAGUE_NAV)[number]): LeagueNavLink => ({
    id: item.segment || 'home',
    href: leagueUrl(league.slug, item.segment),
    label: item.segment ? item.label : 'Home',
  });

  const homeItem = visibleNavItems.find((item) => item.segment === '');
  const leagueChildren = visibleNavItems
    .filter((item) => LEAGUE_SECTION_SEGMENTS.has(item.segment))
    .map(toNavLink);

  const orderedStandalone = STANDALONE_NAV_ORDER.flatMap((segment) => {
    const item = visibleNavItems.find((candidate) => candidate.segment === segment);
    return item ? [toNavLink(item)] : [];
  });

  const knownStandaloneSegments = new Set<string>(STANDALONE_NAV_ORDER);
  const additionalStandalone = visibleNavItems
    .filter(
      (item) => item.segment
        && !LEAGUE_SECTION_SEGMENTS.has(item.segment)
        && !knownStandaloneSegments.has(item.segment),
    )
    .map(toNavLink);

  const navLinks: LeagueNavLink[] = [
    ...(homeItem ? [toNavLink(homeItem)] : []),
    ...(leagueChildren.length > 0
      ? [{ id: 'league', label: 'League', children: leagueChildren }]
      : []),
    ...orderedStandalone,
    ...additionalStandalone,
  ];
  const brandingHref = `/api/league/select?id=${encodeURIComponent(league.id)}&next=${encodeURIComponent('/settings/branding')}`;
  const mobileLinks = [
    ...(canOpenDashboard ? [{ href: leagueUrl(league.slug, 'dashboard'), label: 'Dashboard' }, { href: brandingHref, label: 'Branding' }] : []),
    ...visibleNavItems
      .filter((item) => item.segment !== '')
      .map((item) => ({ href: leagueUrl(league.slug, item.segment), label: item.label })),
  ];

  const allLeagueIds = league.sleeperLeagueIds || {};
  const currentSeason = Object.entries(allLeagueIds)
    .find(([, id]) => id === league.sleeperLeagueId)?.[0] || '';
  const previousLeagueIds = Object.fromEntries(
    Object.entries(allLeagueIds).filter(([, id]) => id !== league.sleeperLeagueId),
  );
  const franchiseNamesByOwnerId = await getFranchiseNamesByOwnerId({
    sleeperLeagueId: league.sleeperLeagueId,
    config: league.config,
  });
  const runtimeConfigValue = {
    currentLeagueId: league.sleeperLeagueId || '',
    currentSeason,
    previousLeagueIds,
    franchiseNamesByOwnerId,
  };
  const runtimeBrandingValue = {
    name: league.name,
    shortName: league.shortName,
    logoUrl: league.logoUrl,
    primaryColor: storedAccent,
    secondaryColor: storedSecondary,
  };
  const runtimeConfig = safeJson(runtimeConfigValue);
  const runtimeBranding = safeJson(runtimeBrandingValue);
  const dashboardHref = `/api/league/select?id=${encodeURIComponent(league.id)}&next=${encodeURIComponent(`/l/${league.slug}/dashboard`)}`;
  const adminHref = `/api/league/select?id=${encodeURIComponent(league.id)}&next=${encodeURIComponent('/settings')}`;

  return (
    <div
      className="flex min-h-full flex-col"
      style={{
        '--accent': accent,
        '--focus': accent,
        '--gold': secondary,
        '--on-accent': onAccent,
        '--on-gold': onSecondary,
        '--league-accent': accent,
        '--league-secondary': secondary,
        '--league-highlight': semantic.highlight,
        '--league-border-highlight': semantic.borderHighlight,
        '--league-on-accent': semantic.onAccent,
        '--league-on-secondary': semantic.onSecondaryAccent,
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
              {canOpenDashboard && <a href={brandingHref} className="rounded-full border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/60 transition hover:border-white/30 hover:text-white">Branding</a>}
              {canAdmin && <a href={adminHref} className="rounded-full border border-[var(--gold)]/60 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/5">Commissioner Settings</a>}
            </div>
          </div>
        </div>
        <LeagueNav links={navLinks} accent={storedAccent} />
      </header>
      <div className="flex-grow pb-20 md:pb-0">{children}</div>
      <LeagueMobileNav links={mobileLinks} />
    </div>
  );
}
