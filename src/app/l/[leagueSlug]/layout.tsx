import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentLeagueBySlug, getLeagueFeatures } from '@/lib/server/league-context';
import { LEAGUE_NAV, leagueUrl } from '@/lib/config/platform';
import LeagueNav from '@/components/league/LeagueNav';

export const dynamic = 'force-dynamic';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
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

  const features = getLeagueFeatures(league);
  const accent = league.primaryColor || 'var(--accent)';
  const secondary = league.secondaryColor || 'var(--gold)';

  const navLinks = LEAGUE_NAV.filter((item) => !item.feature || features[item.feature]).map((item) => ({
    href: leagueUrl(league.slug, item.segment),
    label: item.label,
  }));

  return (
    <div
      className="flex min-h-full flex-col"
      style={{ '--league-accent': accent, '--league-secondary': secondary } as React.CSSProperties}
    >
      {/* League identity header */}
      <header
        style={{ background: 'var(--brand-navy)', boxShadow: `inset 0 -3px 0 ${accent}`, borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between gap-3 py-3">
            <Link href={leagueUrl(league.slug)} className="flex min-w-0 items-center gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10"
                style={{ backgroundColor: `color-mix(in srgb, ${accent} 18%, #0a1c48)` }}
              >
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
                  {league.shortName || 'League Headquarters'}
                  {league.foundedYear ? ` · Est. ${league.foundedYear}` : ''}
                </p>
              </div>
            </Link>
            {/* League switcher placeholder — becomes a real switcher with multi-league accounts */}
            <Link
              href="/app/leagues"
              className="hidden shrink-0 items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/50 transition hover:border-white/30 hover:text-white sm:inline-flex"
            >
              Switch league
              <span aria-hidden="true" className="text-xs">▾</span>
            </Link>
          </div>
        </div>
        <LeagueNav links={navLinks} accent={league.primaryColor} />
      </header>

      <div className="flex-grow">{children}</div>
    </div>
  );
}
