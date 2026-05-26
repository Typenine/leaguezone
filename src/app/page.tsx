import Link from 'next/link';
import { getAllLeagues } from '@/lib/server/league-config';
import type { LeagueSummary } from '@/lib/server/league-config';

const FEATURES = [
  { icon: 'ðŸ†', label: 'Standings',    href: '/standings',    desc: 'Win/loss records & rankings' },
  { icon: 'ðŸˆ', label: 'Matchups',     href: '/matchups',     desc: 'Weekly scores & head-to-head' },
  { icon: 'ðŸ‘¥', label: 'Teams',        href: '/teams',        desc: 'Rosters, profiles & pages' },
  { icon: 'ðŸ”„', label: 'Trades',       href: '/trades',       desc: 'Trade history & analyzer' },
  { icon: 'ðŸ“œ', label: 'History',      href: '/history',      desc: 'Champions & all-time records' },
  { icon: 'ðŸ“', label: 'Transactions', href: '/transactions', desc: 'Free agency & waiver moves' },
  { icon: 'ðŸ“‹', label: 'Rules',        href: '/rules',        desc: 'League constitution' },
  { icon: 'ðŸ’¡', label: 'Suggestions',  href: '/suggestions',  desc: 'Rule proposals & voting' },
];

function getInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

/** Full-featured landing for a single league */
function SingleLeagueLanding({ league }: { league: LeagueSummary }) {
  const accent = league.primaryColor || 'var(--accent)';
  const initials = getInitials(league.name);

  return (
    <div>
      {/* â”€â”€ Hero â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${accent}18 0%, transparent 60%)`,
          borderBottom: `1px solid var(--border)`,
        }}
      >
        <div className="container mx-auto px-4 py-16 sm:py-24 text-center">
          {/* Logo */}
          <div
            className="mx-auto w-28 h-28 rounded-2xl flex items-center justify-center overflow-hidden mb-6 border border-[var(--border)] shadow-xl"
            style={{ backgroundColor: `${accent}22` }}
          >
            {league.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={league.logoUrl} alt={league.name} className="w-full h-full object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/assets/teams/East v West Logos/EvW Clancy logo.png" alt="League logo" className="w-full h-full object-contain" />
            )}
          </div>

          <h1 className="text-5xl sm:text-6xl font-black text-[var(--text)] mb-3 tracking-tight">
            {league.name}
          </h1>
          {league.shortName && (
            <p className="text-xl text-[var(--muted)] mb-2">{league.shortName}</p>
          )}
          {league.foundedYear && (
            <p className="text-sm text-[var(--muted)] mb-8">
              Dynasty Fantasy Football Â· Est. {league.foundedYear}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={`/api/league/select?id=${league.id}`}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold text-white text-lg shadow-lg hover:opacity-90 active:scale-95 transition-all"
              style={{ backgroundColor: accent }}
            >
              Enter League
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </a>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-semibold border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--accent)]/60 transition-all"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* â”€â”€ About the league â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center mb-16">
          {[
            { icon: 'ðŸˆ', label: 'Dynasty', desc: 'Keep your players year to year' },
            { icon: 'ðŸ‘‘', label: league.foundedYear ? `Since ${league.foundedYear}` : 'Long-running', desc: 'Season after season of competition' },
            { icon: 'âš¡', label: 'Live Scoring', desc: 'Real-time stats powered by Sleeper' },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
            >
              <div className="text-3xl mb-2">{item.icon}</div>
              <div className="font-bold text-[var(--text)] mb-1">{item.label}</div>
              <div className="text-sm text-[var(--muted)]">{item.desc}</div>
            </div>
          ))}
        </div>

        {/* â”€â”€ Features grid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <h2 className="text-2xl font-bold text-[var(--text)] mb-6 text-center">Everything in One Place</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {FEATURES.map((f) => (
            <a
              key={f.href}
              href={`/api/league/select?id=${league.id}&next=${encodeURIComponent(f.href)}`}
              className="group p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/60 hover:bg-[color-mix(in_srgb,var(--accent)_4%,var(--surface))] transition-all"
            >
              <div className="text-2xl mb-2">{f.icon}</div>
              <div className="font-semibold text-sm text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
                {f.label}
              </div>
              <div className="text-xs text-[var(--muted)] mt-0.5 hidden sm:block">{f.desc}</div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Multi-league hub */
function LeagueCard({ league }: { league: LeagueSummary }) {
  const accent = league.primaryColor || 'var(--accent)';
  const initials = getInitials(league.name);

  return (
    <a
      href={`/api/league/select?id=${league.id}`}
      className="group flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/60 transition-all overflow-hidden shadow-sm hover:shadow-md"
    >
      <div className="h-2 w-full" style={{ backgroundColor: accent }} />
      <div className="flex flex-col flex-1 p-6 gap-4">
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 border border-[var(--border)]"
            style={{ backgroundColor: `${accent}22` }}
          >
            {league.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={league.logoUrl} alt={league.name} className="w-full h-full object-contain" />
            ) : (
              <span className="text-xl font-bold" style={{ color: accent }}>{initials}</span>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-[var(--text)] text-lg leading-tight truncate group-hover:text-[var(--accent)] transition-colors">{league.name}</h2>
            {league.shortName && <p className="text-sm text-[var(--muted)] mt-0.5">{league.shortName}</p>}
            {league.foundedYear && <p className="text-xs text-[var(--muted)] mt-0.5">Est. {league.foundedYear}</p>}
          </div>
        </div>
        <div className="mt-auto pt-2">
          <span className="inline-flex items-center gap-1 text-sm font-semibold transition-colors" style={{ color: accent }}>
            Enter League
            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </a>
  );
}

export default async function RootPage() {
  const leagues = await getAllLeagues();

  if (leagues.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="text-6xl mb-6">ðŸˆ</div>
        <h1 className="text-3xl font-bold text-[var(--text)] mb-4">No Leagues Configured</h1>
        <p className="text-[var(--muted)] mb-8 max-w-sm">No leagues have been set up yet. Visit the setup page to get started.</p>
        <Link href="/setup" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-[var(--accent)] text-white hover:opacity-90 transition-opacity">
          Go to Setup
        </Link>
      </div>
    );
  }

  if (leagues.length === 1) {
    return <SingleLeagueLanding league={leagues[0]} />;
  }

  return (
    <div>
      {/* Multi-league hub hero */}
      <section className="container mx-auto px-4 py-16 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/teams/East v West Logos/EvW Clancy logo.png" alt="League logo" className="w-20 h-20 object-contain mx-auto mb-6" />
        <h1 className="text-4xl font-black text-[var(--text)] mb-2">Fantasy Football Leagues</h1>
        <p className="text-[var(--muted)] mb-10">Select a league to enter</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {leagues.map((league) => (
            <LeagueCard key={league.id} league={league} />
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-[var(--border)] bg-[var(--surface)] py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-xl font-bold text-[var(--text)] mb-6 text-center">What&apos;s Inside</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {FEATURES.map((f) => (
              <div key={f.href} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-center">
                <div className="text-2xl mb-1">{f.icon}</div>
                <div className="text-sm font-semibold text-[var(--text)]">{f.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

