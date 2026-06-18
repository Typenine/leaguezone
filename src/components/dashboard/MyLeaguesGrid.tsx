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
      <div className="mb-4">
        <span className="text-[10px] font-black uppercase tracking-[0.28em] text-[var(--brand-gold)]">{role}</span>
      </div>
      <h3 className="text-xl font-black uppercase tracking-tight text-[var(--text)]">{league.leagueName}</h3>
      <p className="mt-1 flex-1 text-sm text-[var(--muted)]">{league.teamName}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href={leagueUrl(league.leagueSlug)}
          className="inline-flex items-center justify-center bg-[var(--brand-gold)] text-[var(--brand-ink)] px-4 py-2 text-xs font-black uppercase tracking-wider transition hover:brightness-110"
        >
          Open Site
        </Link>
        {league.isCommissioner && (
          <a
            href={dashboardHref(league.leagueId, '/settings')}
            className="inline-flex items-center justify-center border border-white/20 text-[var(--text)] px-4 py-2 text-xs font-bold uppercase tracking-wider transition hover:bg-white/5"
          >
            Admin
          </a>
        )}
        <a
          href={dashboardHref(league.leagueId, '/home')}
          className="inline-flex items-center justify-center border border-white/20 text-[var(--text)] px-4 py-2 text-xs font-bold uppercase tracking-wider transition hover:bg-white/5"
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
      <div className="space-y-4">
        {/* Join a League Card */}
        <div className="league-card p-7">
          <div className="flex items-start gap-5">
            <div className="flex-shrink-0 w-11 h-11 bg-green-500/10 border border-green-500/20 flex items-center justify-center text-xl">
              👋
            </div>
            <div className="flex-1">
              <h3 className="text-base font-black uppercase tracking-wide text-[var(--text)]">Join an Existing League</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Already have a team in a league? Ask your commissioner for an invite link, then click it to claim your roster.
              </p>
              <div className="mt-4 flex items-center gap-3 text-xs text-[var(--muted)]">
                <span className="flex items-center gap-1.5">
                  <span className="w-5 h-5 bg-[var(--surface-strong)] flex items-center justify-center text-xs font-black text-[var(--brand-gold)]">1</span>
                  Get invite link
                </span>
                <span className="text-white/20">→</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-5 h-5 bg-[var(--surface-strong)] flex items-center justify-center text-xs font-black text-[var(--brand-gold)]">2</span>
                  Click to claim
                </span>
                <span className="text-white/20">→</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-5 h-5 bg-[var(--surface-strong)] flex items-center justify-center text-xs font-black text-[var(--brand-gold)]">3</span>
                  Access your team
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Create a League Card */}
        <div className="league-card p-7">
          <div className="flex items-start gap-5">
            <div className="flex-shrink-0 w-11 h-11 bg-[var(--brand-gold)]/10 border border-[var(--brand-gold)]/20 flex items-center justify-center text-xl">
              ⭐
            </div>
            <div className="flex-1">
              <h3 className="text-base font-black uppercase tracking-wide text-[var(--text)]">Start a New League</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Want to run your own league? Set up a branded league site with standings, trades, voting, and history.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/setup"
                  className="inline-flex justify-center bg-[var(--brand-gold)] text-[var(--brand-ink)] px-5 py-2.5 text-xs font-black uppercase tracking-wider transition hover:brightness-110"
                >
                  Create League
                </Link>
                <a
                  href={`mailto:${PLATFORM.contactEmail}`}
                  className="inline-flex justify-center border border-white/20 text-[var(--text)] px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition hover:bg-white/5"
                >
                  Request Help
                </a>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-[var(--muted)]">
          Not sure? <a href={`mailto:${PLATFORM.contactEmail}`} className="text-[var(--brand-gold)] hover:underline font-bold">Contact us</a> and we&apos;ll point you in the right direction.
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
