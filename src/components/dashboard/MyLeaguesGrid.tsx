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
      <div className="space-y-6">
        {/* Join a League Card */}
        <div className="league-card p-8">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-2xl">
              👋
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-[var(--text)]">Join an Existing League</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Already have a team in a league? Ask your commissioner for an invite link, then click it to claim your roster.
              </p>
              <div className="mt-4 flex items-center gap-3 text-sm text-[var(--muted)]">
                <span className="flex items-center gap-1">
                  <span className="w-5 h-5 rounded-full bg-[var(--surface-strong)] flex items-center justify-center text-xs font-bold">1</span>
                  Get invite link
                </span>
                <span>→</span>
                <span className="flex items-center gap-1">
                  <span className="w-5 h-5 rounded-full bg-[var(--surface-strong)] flex items-center justify-center text-xs font-bold">2</span>
                  Click to claim
                </span>
                <span>→</span>
                <span className="flex items-center gap-1">
                  <span className="w-5 h-5 rounded-full bg-[var(--surface-strong)] flex items-center justify-center text-xs font-bold">3</span>
                  Access your team
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Create a League Card */}
        <div className="league-card p-8">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[var(--accent)]/10 flex items-center justify-center text-2xl">
              ⭐
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-[var(--text)]">Start a New League</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Want to run your own league? Set up a branded league site with standings, trades, voting, and history.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/setup"
                  className="inline-flex justify-center rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
                  style={{ color: 'white' }}
                >
                  Create League
                </Link>
                <a
                  href={`mailto:${PLATFORM.contactEmail}`}
                  className="inline-flex justify-center rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-bold text-[var(--text)] transition hover:border-[var(--accent)]/60"
                >
                  Request Help
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Help tip */}
        <p className="text-center text-sm text-[var(--muted)]">
          Not sure? <a href={`mailto:${PLATFORM.contactEmail}`} className="text-[var(--accent)] hover:underline">Contact us</a> and we&apos;ll point you in the right direction.
        </p>
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
