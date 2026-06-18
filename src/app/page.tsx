import { cookies } from 'next/headers';
import Link from 'next/link';
import { verifySession } from '@/lib/server/auth';
import { getAllLeagues } from '@/lib/server/league-config';
import type { LeagueSummary } from '@/lib/server/league-config';
import { getUserLeagues, type UserLeague } from '@/lib/server/user-auth';
import LeagueWebsiteSearch from '@/components/LeagueWebsiteSearch';
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
  const accent = league.primaryColor || 'var(--brand-gold)';
  const initials = getInitials(league.name);

  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden border border-white/15"
      style={{ backgroundColor: `color-mix(in srgb, ${accent} 20%, #040c1a)` }}
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
      className="group block border border-white/10 bg-white/[0.03] p-5 hover:border-[var(--brand-gold)]/50 hover:bg-white/[0.06] transition-all"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-[10px] font-black uppercase tracking-[0.28em] text-[var(--brand-gold)]">My League</span>
        {league.isCommissioner && (
          <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
            <span className="text-[var(--brand-gold)]">★</span> Commissioner
          </span>
        )}
      </div>
      <h3 className="text-xl font-black text-white uppercase tracking-tight group-hover:text-[var(--brand-gold)] transition-colors">
        {league.leagueName}
      </h3>
      <p className="mt-1 text-sm text-white/50">{league.teamName}</p>
      <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--brand-gold)] uppercase tracking-wider">
        Open league site →
      </span>
    </Link>
  );
}

function PublicLeagueCard({ league }: { league: LeagueSummary }) {
  const accent = league.primaryColor || 'var(--brand-gold)';

  return (
    <Link
      href={leagueUrl(league.slug)}
      className="group flex items-center gap-4 border border-white/10 bg-white/[0.03] p-4 hover:border-[var(--brand-gold)]/50 hover:bg-white/[0.06] transition-all"
    >
      <LeagueLogo league={league} />
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-black text-white text-sm uppercase tracking-wide group-hover:text-[var(--brand-gold)] transition-colors">{league.name}</h3>
        <p className="text-xs text-white/45 mt-0.5">
          {league.shortName || (league.foundedYear ? `Est. ${league.foundedYear}` : 'League site')}
        </p>
      </div>
      <span className="text-sm font-bold shrink-0" style={{ color: accent }}>View →</span>
    </Link>
  );
}

function ProductPreview() {
  return (
    <div className="relative mx-auto max-w-xl">
      <div className="relative overflow-hidden border border-[var(--brand-gold)]/30 bg-[#040c1a] p-4 shadow-2xl shadow-black/60">
        <div className="border border-white/10 bg-[#071020] p-4">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--brand-gold)]">Week 12</p>
              <h2 className="text-2xl font-black text-white uppercase">League HQ</h2>
            </div>
            <div className="border border-[var(--brand-gold)]/40 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[var(--brand-gold)]">
              Live Board
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Standings', '8-3', 'First place', 'command'],
              ['Matchups', '6', 'Live games', 'managers'],
              ['Trades', '14', 'Tracked trees', 'trade'],
              ['History', '9', 'Seasons', 'trophy'],
            ].map(([label, value, caption, icon]) => (
              <div key={label} className="border-t-2 border-[var(--brand-gold)]/60 bg-[#040c1a] p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">{label}</p>
                  <LeagueIcon name={icon as LeagueIconName} className="h-3.5 w-3.5 text-[var(--brand-gold)]/60" />
                </div>
                <p className="text-3xl font-black text-white">{value}</p>
                <p className="text-xs text-white/40 mt-0.5">{caption}</p>
              </div>
            ))}
          </div>
          <div className="mt-2 border border-white/10 bg-[#040c1a] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-black text-white text-sm uppercase tracking-wide">Featured Matchup</p>
              <p className="text-sm font-bold text-[var(--brand-gold)]">52%</p>
            </div>
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-white/60 uppercase tracking-wide">North Division</span>
                  <span className="font-black text-white">128.4</span>
                </div>
                <div className="h-1.5 bg-white/10">
                  <div className="h-1.5 w-[72%] bg-[var(--brand-gold)]" />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-white/60 uppercase tracking-wide">South Division</span>
                  <span className="font-black text-white">121.8</span>
                </div>
                <div className="h-1.5 bg-white/10">
                  <div className="h-1.5 w-[64%] bg-[var(--brand-blue)]" />
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
    <div style={{ background: 'var(--brand-ink)' }} className="overflow-hidden">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(160deg, var(--brand-navy) 0%, var(--brand-ink) 65%)' }} className="relative border-b border-white/10">
        <div className="container mx-auto px-4 py-20 sm:py-28 lg:grid lg:grid-cols-[1fr_0.9fr] lg:items-center lg:gap-16">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-6">
              <span className="block w-8 h-px bg-[var(--brand-gold)]" />
              <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--brand-gold)]">Dynasty League Headquarters</span>
            </div>
            <h1 className="text-5xl sm:text-6xl font-black leading-none tracking-tighter text-white uppercase">
              {PLATFORM.name}
            </h1>
            <p className="mt-5 text-lg text-white/65 leading-relaxed max-w-xl">
              {PLATFORM.description}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/demo"
                className="inline-flex items-center justify-center gap-2 bg-[var(--brand-gold)] text-[var(--brand-ink)] font-black uppercase tracking-widest px-8 py-3.5 text-sm transition hover:brightness-110"
              >
                View Demo League
              </Link>
              {userId ? (
                <Link
                  href="/app"
                  className="inline-flex items-center justify-center border border-white/25 text-white font-bold uppercase tracking-wider px-8 py-3.5 text-sm transition hover:border-white/50 hover:bg-white/5"
                >
                  Open My Dashboard
                </Link>
              ) : (
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center border border-white/25 text-white font-bold uppercase tracking-wider px-8 py-3.5 text-sm transition hover:border-white/50 hover:bg-white/5"
                >
                  Start a Beta Build
                </Link>
              )}
            </div>
            <div className="mt-12 grid grid-cols-3 gap-3 max-w-sm">
              {[['24/7', 'League Access'], ['Live', 'Sleeper Sync'], ['All-Time', 'History']].map(([val, lbl]) => (
                <div key={lbl} className="border border-white/10 bg-white/5 p-3 text-center">
                  <p className="text-xl font-black text-white">{val}</p>
                  <p className="text-[10px] uppercase tracking-wider text-white/45 mt-0.5">{lbl}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-12 lg:mt-0">
            <ProductPreview />
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section className="container mx-auto px-4 py-16 sm:py-20">
        <div className="flex items-center gap-3 mb-3">
          <span className="block w-6 h-px bg-[var(--brand-gold)]" />
          <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--brand-gold)]">Platform Features</span>
        </div>
        <div className="mb-10 grid gap-4 lg:grid-cols-[0.8fr_1fr] lg:items-end">
          <h2 className="text-4xl sm:text-5xl font-black text-white uppercase leading-none tracking-tighter">
            The features Sleeper doesn&apos;t do.
          </h2>
          <p className="text-white/60 text-lg max-w-2xl">
            Sleeper handles rosters and scoring. {PLATFORM.name} handles identity, history, rules, and league culture — the things that make a dynasty league feel permanent.
          </p>
        </div>
        <div className="grid gap-px md:grid-cols-2 lg:grid-cols-4 bg-white/10">
          {PRODUCT_FEATURES.map((feature) => (
            <div key={feature.title} className="bg-[var(--brand-ink)] border-t-2 border-[var(--brand-gold)]/70 p-5 flex flex-col gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--brand-gold)]">{feature.eyebrow}</span>
              <h3 className="font-black text-white text-base leading-tight">{feature.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 text-right">
          <Link href="/features" className="text-sm font-bold text-[var(--brand-gold)] hover:underline uppercase tracking-wider">
            All Features →
          </Link>
        </div>
      </section>

      {/* ── Demo preview ─────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(160deg, var(--brand-navy) 0%, var(--brand-ink) 70%)' }} className="border-y border-white/10">
        <div className="container mx-auto px-4 py-16 sm:py-20 lg:grid lg:grid-cols-[0.72fr_1fr] lg:items-center lg:gap-16">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="block w-6 h-px bg-[var(--brand-gold)]" />
              <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--brand-gold)]">See It Live</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-white uppercase leading-none tracking-tighter">
              Tour a real<br />league site.
            </h2>
            <p className="mt-5 text-white/60 text-lg leading-relaxed">
              The demo league is a live, working league headquarters — branded homepage, team pages, draft hub, trade block, and a decade of league history.
            </p>
            <Link
              href="/demo"
              className="mt-8 inline-flex items-center gap-2 bg-[var(--brand-gold)] text-[var(--brand-ink)] font-black uppercase tracking-widest px-8 py-3.5 text-sm transition hover:brightness-110"
            >
              Open the Demo League
            </Link>
          </div>
          <div className="mt-12 lg:mt-0">
            <ProductPreview />
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section className="container mx-auto px-4 py-16 sm:py-20">
        <div className="flex items-center gap-3 mb-3">
          <span className="block w-6 h-px bg-[var(--brand-gold)]" />
          <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--brand-gold)]">How It Works</span>
        </div>
        <h2 className="text-4xl sm:text-5xl font-black text-white uppercase leading-none tracking-tighter mb-10">
          Launch in an afternoon.
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 border border-white/10">
          {HOW_IT_WORKS.map((item, i) => (
            <div key={item.step} className={`p-6 ${i < HOW_IT_WORKS.length - 1 ? 'border-b sm:border-b-0 sm:border-r border-white/10' : ''}`}>
              <p className="text-4xl font-black text-[var(--brand-gold)] opacity-40 mb-3 leading-none">{item.step}</p>
              <h3 className="text-sm font-black text-white uppercase tracking-wide mb-2">{item.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(160deg, var(--brand-navy) 0%, var(--brand-ink) 70%)' }} className="border-y border-white/10">
        <div className="container mx-auto px-4 py-16 sm:py-20">
          <div className="text-center mb-10">
            <div className="flex items-center justify-center gap-3 mb-3">
              <span className="block w-6 h-px bg-[var(--brand-gold)]" />
              <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--brand-gold)]">Pricing</span>
              <span className="block w-6 h-px bg-[var(--brand-gold)]" />
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-white uppercase leading-none tracking-tighter">
              Simple plans, league-first.
            </h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {PRICING_TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`p-6 border ${tier.highlighted ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/5' : 'border-white/10 bg-white/[0.03]'}`}
              >
                {tier.highlighted && (
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--brand-gold)] block mb-3">Most Popular</span>
                )}
                <h3 className="text-sm font-black uppercase tracking-wide text-white">{tier.name}</h3>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-black text-white">{tier.price}</span>
                  <span className="text-sm text-white/45">{tier.period}</span>
                </div>
                <p className="mt-3 text-sm text-white/50 leading-relaxed">{tier.description}</p>
                <ul className="mt-4 space-y-1.5">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-white/65">
                      <span className="text-[var(--brand-gold)] mt-0.5 shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={tier.href}
                  className={`mt-5 w-full inline-flex items-center justify-center py-2.5 text-sm font-black uppercase tracking-wider transition ${
                    tier.highlighted
                      ? 'bg-[var(--brand-gold)] text-[var(--brand-ink)] hover:brightness-110'
                      : 'border border-white/20 text-white hover:bg-white/5'
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/pricing" className="text-sm font-bold text-[var(--brand-gold)] hover:underline uppercase tracking-wider">
              Full pricing details →
            </Link>
          </div>
        </div>
      </section>

      {/* ── My leagues / sign in ─────────────────────────────── */}
      <section className="container mx-auto px-4 py-16 sm:py-20">
        <div className="mb-12">
          <LeagueWebsiteSearch />
        </div>

        {userId ? (
          <div id="my-leagues">
            <div className="flex items-center gap-3 mb-3">
              <span className="block w-6 h-px bg-[var(--brand-gold)]" />
              <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--brand-gold)]">My Leagues</span>
            </div>
            <div className="flex items-end justify-between mb-6">
              <h2 className="text-3xl font-black text-white uppercase leading-none">Pick up where you left off.</h2>
              <Link href="/app" className="text-sm font-bold text-[var(--brand-gold)] hover:underline uppercase tracking-wider shrink-0">
                Dashboard →
              </Link>
            </div>
            {userLeagues.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {userLeagues.map((league) => (
                  <MyLeagueCard key={league.leagueId} league={league} />
                ))}
              </div>
            ) : (
              <div className="border border-dashed border-white/20 p-8 text-center">
                <h3 className="text-xl font-black text-white uppercase">No leagues yet</h3>
                <p className="mt-2 text-white/50">Ask your commissioner for an invite link, or create a new league site.</p>
                <Link href="/setup" className="mt-5 inline-flex bg-[var(--brand-gold)] text-[var(--brand-ink)] font-black uppercase tracking-wider px-6 py-3 text-sm transition hover:brightness-110">
                  Set up a league
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="border border-white/10 bg-white/[0.03] p-8 sm:p-12 text-center">
            <div className="flex items-center justify-center gap-3 mb-3">
              <span className="block w-6 h-px bg-[var(--brand-gold)]" />
              <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--brand-gold)]">For Managers</span>
              <span className="block w-6 h-px bg-[var(--brand-gold)]" />
            </div>
            <h2 className="text-3xl font-black text-white uppercase">Already in a league?</h2>
            <p className="mx-auto mt-3 max-w-2xl text-white/50">
              Sign in to see your leagues, open your league sites, and jump straight to the pages your league uses most.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/login" className="inline-flex justify-center bg-[var(--brand-gold)] text-[var(--brand-ink)] font-black uppercase tracking-wider px-6 py-3 text-sm transition hover:brightness-110">
                Sign In
              </Link>
              <Link href="/register" className="inline-flex justify-center border border-white/20 text-white font-bold uppercase tracking-wider px-6 py-3 text-sm hover:bg-white/5 transition">
                Create Account
              </Link>
            </div>
          </div>
        )}

        {leagues.length > 0 && (
          <div id="available-leagues" className="mt-16">
            <div className="flex items-center gap-3 mb-3">
              <span className="block w-6 h-px bg-[var(--brand-gold)]" />
              <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--brand-gold)]">League Access</span>
            </div>
            <h2 className="text-2xl font-black text-white uppercase mb-6">Leagues hosted here</h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {leagues.map((league) => (
                <PublicLeagueCard key={league.id} league={league} />
              ))}
            </div>
          </div>
        )}

        {leagues.length === 0 && (
          <div className="border border-white/10 mt-16 p-8 text-center">
            <h2 className="text-2xl font-black text-white uppercase">No leagues configured yet</h2>
            <p className="mx-auto mt-2 max-w-xl text-white/50">
              Finish setup to connect your league data, add branding, and launch the first league site.
            </p>
            <Link href="/setup" className="mt-5 inline-flex bg-[var(--brand-gold)] text-[var(--brand-ink)] font-black uppercase tracking-wider px-6 py-3 text-sm transition hover:brightness-110">
              Go to Setup
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
