import Link from 'next/link';
import { getAllLeagues } from '@/lib/server/league-config';
import type { LeagueSummary } from '@/lib/server/league-config';

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function LeagueCard({ league }: { league: LeagueSummary }) {
  const initials = getInitials(league.name);
  const accent = league.primaryColor || 'var(--accent)';

  return (
    <a
      href={`/api/league/select?id=${league.id}`}
      className="group flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/60 transition-all overflow-hidden shadow-sm hover:shadow-md"
    >
      {/* Header stripe */}
      <div
        className="h-2 w-full"
        style={{ backgroundColor: accent }}
      />

      <div className="flex flex-col flex-1 p-6 gap-4">
        {/* Logo / initials */}
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 border border-[var(--border)]"
            style={{ backgroundColor: `${accent}22` }}
          >
            {league.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={league.logoUrl}
                alt={league.name}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <span className="text-xl font-bold" style={{ color: accent }}>
                {initials}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <h2 className="font-bold text-[var(--text)] text-lg leading-tight truncate group-hover:text-[var(--accent)] transition-colors">
              {league.name}
            </h2>
            {league.shortName && (
              <p className="text-sm text-[var(--muted)] mt-0.5">{league.shortName}</p>
            )}
            {league.foundedYear && (
              <p className="text-xs text-[var(--muted)] mt-0.5">Est. {league.foundedYear}</p>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-auto pt-2">
          <span
            className="inline-flex items-center gap-1 text-sm font-semibold transition-colors"
            style={{ color: accent }}
          >
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

function SingleLeagueLanding({ league }: { league: LeagueSummary }) {
  const accent = league.primaryColor || 'var(--accent)';
  const initials = getInitials(league.name);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-16 text-center">
      {/* Logo */}
      <div
        className="w-24 h-24 rounded-2xl flex items-center justify-center overflow-hidden mb-6 border border-[var(--border)] shadow-lg"
        style={{ backgroundColor: `${accent}22` }}
      >
        {league.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={league.logoUrl}
            alt={league.name}
            className="w-full h-full object-contain"
          />
        ) : (
          <span className="text-3xl font-black" style={{ color: accent }}>
            {initials}
          </span>
        )}
      </div>

      <h1 className="text-4xl font-black text-[var(--text)] mb-2">{league.name}</h1>
      {league.shortName && (
        <p className="text-lg text-[var(--muted)] mb-2">{league.shortName}</p>
      )}
      {league.foundedYear && (
        <p className="text-sm text-[var(--muted)] mb-8">Dynasty League · Est. {league.foundedYear}</p>
      )}

      <a
        href={`/api/league/select?id=${league.id}`}
        className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-white text-lg shadow-md hover:opacity-90 transition-opacity"
        style={{ backgroundColor: accent }}
      >
        Enter League
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </a>
    </div>
  );
}

export default async function RootPage() {
  const leagues = await getAllLeagues();

  if (leagues.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="text-6xl mb-6">🏈</div>
        <h1 className="text-3xl font-bold text-[var(--text)] mb-4">No Leagues Configured</h1>
        <p className="text-[var(--muted)] mb-8 max-w-sm">
          No leagues have been set up yet. Visit the setup page to get started.
        </p>
        <Link
          href="/setup"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
        >
          Go to Setup
        </Link>
      </div>
    );
  }

  if (leagues.length === 1) {
    return <SingleLeagueLanding league={leagues[0]} />;
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-black text-[var(--text)] mb-2">Choose Your League</h1>
        <p className="text-[var(--muted)]">Select a league to enter</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {leagues.map((league) => (
          <LeagueCard key={league.id} league={league} />
        ))}
      </div>
    </div>
  );
}
