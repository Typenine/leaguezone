import { cookies } from 'next/headers';
import Link from 'next/link';
import { verifySession } from '@/lib/server/auth';
import { getAllLeagues } from '@/lib/server/league-config';
import type { LeagueSummary } from '@/lib/server/league-config';
import { getUserLeagues, type UserLeague } from '@/lib/server/user-auth';
import LeagueWebsiteSearch from '@/components/LeagueWebsiteSearch';
import LeagueCard from '@/components/ui/LeagueCard';
import LeagueIcon from '@/components/ui/LeagueIcon';
import type { LeagueIconName } from '@/components/ui/LeagueIcon';
import { PLATFORM, PRODUCT_FEATURES, HOW_IT_WORKS, PRICING_TIERS, leagueUrl } from '@/lib/config/platform';

export const dynamic = 'force-dynamic';

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

function LeagueLogo({ league }: { league: Pick<LeagueSummary, 'name' | 'logoUrl' | 'primaryColor'> }) {
  const accent = league.primaryColor || 'var(--accent)';
  const initials = getInitials(league.name);

  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--border)]"
      style={{ backgroundColor: `color-mix(in srgb, ${accent} 18%, transparent)` }}
    >
      {league.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={league.logoUrl} alt={league.name} className="h-full w-full object-contain" />
      ) : (
        <span className="text-sm font-black" style={{ color: accent }}>{initials}</span>
      )}
    </div>
  );
}

function MyLeagueCard({ league }: { league: UserLeague }) {
  return (
    <Link
      href={leagueUrl(league.leagueSlug)}
      className="league-card group block p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="rounded-full bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
          My League
        </span>
        {league.isCommissioner && (
          <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
            <span className="text-[var(--gold)]" aria-label="Commissioner">★</span> Commissioner
          </span>
        )}
      </div>
      <h3 className="text-xl font-black text-[var(--text)] group-hover:text-[var(--accent)]">
        {league.leagueName}
      </h3>
      <p className="mt-1 text-sm text-[var(--muted)]">{league.teamName}</p>
      <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)]">
        Open league site
        <span aria-hidden="true">-&gt;</span>
      </span>
    </Link>
  );
}

function PublicLeagueCard({ league }: { league: LeagueSummary }) {
  const accent = league.primaryColor || 'var(--accent)';

  return (
    <Link
      href={leagueUrl(league.slug)}
      className="league-card group flex items-center gap-4 p-4"
    >
      <LeagueLogo league={league} />
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-bold text-[var(--text)] group-hover:text-[var(--accent)]">{league.name}</h3>
        <p className="text-sm text-[var(--muted)]">
          {league.shortName || (league.foundedYear ? `Est. ${league.foundedYear}` : 'League site')}
        </p>
      </div>
      <span className="text-sm font-bold" style={{ color: accent }}>View</span>
    </Link>
  );
}

function ProductPreview() {
  return (
    <div className="relative mx-auto max-w-xl">
      <div className="relative overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--home-panel)] p-4 shadow-2xl">
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--accent)]">Week 12</p>
              <h2 className="text-2xl font-black text-[var(--text)]">League HQ</h2>
            </div>
            <div className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
              Live Board
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Standings', '8-3', 'First place', 'command'],
              ['Matchups', '6', 'Live games', 'managers'],
              ['Trades', '14', 'Tracked trees', 'trade'],
              ['History', '9', 'Seasons', 'trophy'],
            ].map(([label, value, caption, icon]) => (
              <div key={label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
                  <LeagueIcon name={icon as LeagueIconName} className="h-4 w-4 text-[var(--accent)]" />
                </div>
                <p className="mt-2 text-3xl font-black text-[var(--text)]">{value}</p>
                <p className="text-sm text-[var(--muted)]">{caption}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-bold text-[var(--text)]">Featured matchup</p>
              <p className="text-sm font-bold text-[var(--accent)]">52%</p>
            </div>
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-[var(--text)]">North Division</span>
                  <span className="font-semibold">128.4</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--surface-strong)]">
                  <div className="h-2 w-[72%] rounded-full bg-[var(--accent)]" />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-[var(--text)]">South Division</span>
                  <span className="font-semibold">121.8</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--surface-strong)]">
                  <div className="h-2 w-[64%] rounded-full bg-[var(--gold)]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function RootPage() {
  const cookieJar = await cookies();
  const sessionToken = cookieJar.get('evw_session')?.value || '';
  const claims = sessionToken ? verifySession(sessionToken) : null;
  const userId = claims?.type === 'user' && typeof claims.sub === 'string' ? claims.sub : null;
  const userLeagues = userId ? await getUserLeagues(userId) : [];
  const leagues = await getAllLeagues();

  return (
    <div className="home-page overflow-hidden">
      {/* Hero */}
      <section className="relative border-b border-[var(--border)]">
        <div className="absolute inset-0 bg-[var(--home-hero)]" />
        <div className="container relative mx-auto grid gap-12 px-4 py-16 sm:py-24 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-2 text-sm font-semibold text-[var(--muted)]">
              Works alongside Sleeper — built for dynasty leagues
            </div>
            <h1 className="display-heading text-[var(--text)]">
              {PLATFORM.tagline}
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-[var(--muted)] sm:text-xl">
              {PLATFORM.description}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/demo"
                className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-7 py-3 text-base font-bold text-white shadow-lg transition hover:opacity-90"
                style={{ color: 'white' }}
              >
                View Demo League
              </Link>
              {userId ? (
                <Link
                  href="/app"
                  className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-7 py-3 text-base font-bold text-[var(--text)] transition hover:border-[var(--accent)]/60"
                >
                  Open my dashboard
                </Link>
              ) : (
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-7 py-3 text-base font-bold text-[var(--text)] transition hover:border-[var(--accent)]/60"
                >
                  Start a Beta Build
                </Link>
              )}
            </div>
            <div className="mt-10 grid max-w-xl grid-cols-3 gap-4">
              {[
                ['24/7', 'league access'],
                ['Live', 'Sleeper data'],
                ['All-time', 'history'],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl border border-[var(--border)] bg-[var(--home-panel)] p-4 shadow-sm">
                  <p className="text-2xl font-black text-[var(--text)]">{value}</p>
                  <p className="text-sm text-[var(--muted)]">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <ProductPreview />
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16 sm:py-20">
        <div className="mb-10 grid gap-4 lg:grid-cols-[0.8fr_1fr] lg:items-end">
          <div>
            <p className="eyebrow">Platform features</p>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.05em] text-[var(--text)] sm:text-5xl">The features Sleeper doesn&apos;t do.</h2>
          </div>
          <p className="max-w-2xl text-lg leading-8 text-[var(--muted)]">
            Sleeper handles rosters and scoring. {PLATFORM.name} handles identity, history, rules, and league culture — the things that make a dynasty league feel permanent.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PRODUCT_FEATURES.map((feature) => (
            <LeagueCard
              key={feature.title}
              eyebrow={feature.eyebrow}
              title={feature.title}
              description={feature.description}
              icon={feature.icon as LeagueIconName}
            />
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/features" className="text-sm font-bold text-[var(--accent)] hover:underline">
            See all features -&gt;
          </Link>
        </div>
      </section>

      {/* Demo preview */}
      <section className="border-y border-[var(--border)] bg-[var(--home-hero)]">
        <div className="container mx-auto grid gap-10 px-4 py-16 lg:grid-cols-[0.72fr_1fr] lg:items-center">
          <div>
            <p className="eyebrow">See it live</p>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.05em] text-[var(--text)] sm:text-5xl">Tour a real league site.</h2>
            <p className="mt-5 text-lg leading-8 text-[var(--muted)]">
              The demo league is a live, working league headquarters — branded homepage, team pages, draft hub, trade block, and a decade of league history.
            </p>
            <Link
              href="/demo"
              className="mt-7 inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-7 py-3 text-base font-bold text-white shadow-lg transition hover:opacity-90"
              style={{ color: 'white' }}
            >
              Open the demo league
            </Link>
          </div>
          <ProductPreview />
        </div>
      </section>

      {/* How it works */}
      <section className="container mx-auto px-4 py-16 sm:py-20">
        <p className="eyebrow">How it works</p>
        <h2 className="mt-3 text-4xl font-black tracking-[-0.05em] text-[var(--text)] sm:text-5xl">Launch in an afternoon.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((item) => (
            <div key={item.step} className="league-card p-5">
              <p className="text-sm font-black text-[var(--accent)]">{item.step}</p>
              <h3 className="mt-2 text-lg font-black text-[var(--text)]">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing preview */}
      <section className="border-y border-[var(--border)] bg-[var(--home-hero)]">
        <div className="container mx-auto px-4 py-16 sm:py-20">
          <div className="mb-10 text-center">
            <p className="eyebrow">Pricing</p>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.05em] text-[var(--text)] sm:text-5xl">Simple plans, league-first.</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {PRICING_TIERS.map((tier) => (
              <div key={tier.name} className={`league-card p-6 ${tier.highlighted ? 'border-[var(--accent)]' : ''}`}>
                <h3 className="text-lg font-black text-[var(--text)]">{tier.name}</h3>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-[var(--text)]">{tier.price}</span>
                  <span className="text-sm text-[var(--muted)]">{tier.period}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{tier.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/pricing" className="text-sm font-bold text-[var(--accent)] hover:underline">
              Full pricing details -&gt;
            </Link>
          </div>
        </div>
      </section>

      {/* My leagues / sign in */}
      <section className="container mx-auto px-4 py-16 sm:py-20">
        <div className="mb-12">
          <LeagueWebsiteSearch />
        </div>

        {userId ? (
          <div id="my-leagues">
            <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="eyebrow">My Leagues</p>
                <h2 className="mt-3 text-3xl font-black text-[var(--text)]">Pick up where you left off.</h2>
              </div>
              <Link href="/app" className="text-sm font-bold text-[var(--accent)] hover:underline">
                Open dashboard
              </Link>
            </div>
            {userLeagues.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {userLeagues.map((league) => (
                  <MyLeagueCard key={league.leagueId} league={league} />
                ))}
              </div>
            ) : (
              <div className="league-card border-dashed p-8 text-center">
                <h3 className="text-xl font-black text-[var(--text)]">No leagues yet</h3>
                <p className="mt-2 text-[var(--muted)]">Ask your commissioner for an invite link, or create a new league site.</p>
                <Link href="/setup" className="mt-5 inline-flex rounded-full bg-[var(--accent)] px-6 py-3 font-bold text-white" style={{ color: 'white' }}>
                  Set up a league
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="league-card p-8 text-center sm:p-12">
            <p className="eyebrow">For managers</p>
            <h2 className="mt-3 text-3xl font-black text-[var(--text)]">Already in a league?</h2>
            <p className="mx-auto mt-3 max-w-2xl text-[var(--muted)]">
              Sign in to see your leagues, open your league sites, and jump straight to the pages your league uses most.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/login" className="inline-flex justify-center rounded-full bg-[var(--accent)] px-6 py-3 font-bold text-white" style={{ color: 'white' }}>
                Sign in
              </Link>
              <Link href="/register" className="inline-flex justify-center rounded-full border border-[var(--border)] px-6 py-3 font-bold text-[var(--text)]">
                Create account
              </Link>
            </div>
          </div>
        )}

        {leagues.length > 0 && (
          <div id="available-leagues" className="mt-16">
            <div className="mb-6">
              <p className="eyebrow">League access</p>
              <h2 className="mt-3 text-2xl font-black text-[var(--text)]">Leagues hosted here</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {leagues.map((league) => (
                <PublicLeagueCard key={league.id} league={league} />
              ))}
            </div>
          </div>
        )}

        {leagues.length === 0 && (
          <div className="league-card mt-16 p-8 text-center">
            <h2 className="text-2xl font-black text-[var(--text)]">No leagues configured yet</h2>
            <p className="mx-auto mt-2 max-w-xl text-[var(--muted)]">
              Finish setup to connect your league data, add branding, and launch the first league site.
            </p>
            <Link href="/setup" className="mt-5 inline-flex rounded-full bg-[var(--accent)] px-6 py-3 font-bold text-white" style={{ color: 'white' }}>
              Go to setup
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
