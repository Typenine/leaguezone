import Link from 'next/link';
import type { UserLeague } from '@/lib/server/user-auth';
import { PLATFORM, leagueUrl } from '@/lib/config/platform';

function dashboardHref(leagueId: string, next: string) {
  return `/api/league/select?id=${encodeURIComponent(leagueId)}&next=${encodeURIComponent(next)}`;
}

function LeagueDashboardCard({ league }: { league: UserLeague }) {
  const role = league.isCommissioner ? 'Commissioner' : 'Owner';

  return (
    <div className="league-card flex flex-col p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="rounded-full bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
          {role}
        </span>
      </div>
      <h3 className="text-xl font-black text-[var(--text)]">{league.leagueName}</h3>
      <p className="mt-1 flex-1 text-sm text-[var(--muted)]">{league.teamName}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href={leagueUrl(league.leagueSlug)}
          className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
          style={{ color: 'white' }}
        >
          Open Site
        </Link>
        {league.isCommissioner && (
          <a
            href={dashboardHref(league.leagueId, '/settings')}
            className="inline-flex items-center justify-center rounded-full border border-[var(--border)] px-4 py-2 text-sm font-bold text-[var(--text)] transition hover:border-[var(--accent)]/60"
          >
            Admin
          </a>
        )}
        <a
          href={dashboardHref(league.leagueId, '/home')}
          className="inline-flex items-center justify-center rounded-full border border-[var(--border)] px-4 py-2 text-sm font-bold text-[var(--text)] transition hover:border-[var(--accent)]/60"
        >
          Dashboard
        </a>
      </div>
    </div>
  );
}

/**
 * "My Leagues" grid shared by /app and /app/leagues.
 * Renders league cards with role labels, or an empty state with a
 * Create League / Request Setup placeholder.
 */
export default function MyLeaguesGrid({ leagues }: { leagues: UserLeague[] }) {
  if (leagues.length === 0) {
    return (
      <div className="league-card border-dashed p-10 text-center">
        <h3 className="text-xl font-black text-[var(--text)]">No leagues yet</h3>
        <p className="mx-auto mt-2 max-w-md text-[var(--muted)]">
          Ask your commissioner for an invite link, or request a new league site and we&apos;ll help you set it up.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/setup"
            className="inline-flex justify-center rounded-full bg-[var(--accent)] px-6 py-3 font-bold text-white"
            style={{ color: 'white' }}
          >
            Create League
          </Link>
          <a
            href={`mailto:${PLATFORM.contactEmail}`}
            className="inline-flex justify-center rounded-full border border-[var(--border)] px-6 py-3 font-bold text-[var(--text)]"
          >
            Request Setup
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {leagues.map((league) => (
        <LeagueDashboardCard key={league.leagueId} league={league} />
      ))}
    </div>
  );
}
