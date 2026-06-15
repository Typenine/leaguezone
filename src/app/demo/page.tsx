import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentLeagueBySlug } from '@/lib/server/league-context';
import { getAllLeagues } from '@/lib/server/league-config';
import { DEFAULT_LEAGUE_SLUG, PLATFORM, leagueUrl } from '@/lib/config/platform';

export const dynamic = 'force-dynamic';

/**
 * Public demo entry point.
 * - If DEFAULT_LEAGUE_SLUG exists (e.g., 'demo' or 'east-v-west'), redirects to it
 * - Otherwise shows list of available leagues (without auto-redirecting)
 * - If no leagues exist, shows setup message
 */
export default async function DemoPage() {
  // Only auto-redirect if an explicit demo league slug is configured and exists
  const demoLeague = await getCurrentLeagueBySlug(DEFAULT_LEAGUE_SLUG);
  if (demoLeague) redirect(leagueUrl(demoLeague.slug));

  const leagues = await getAllLeagues();

  // If no explicit demo but leagues exist, show them as a list (don't auto-redirect)
  if (leagues.length > 0) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <p className="eyebrow">Demo</p>
            <h1 className="mt-3 text-3xl font-black text-[var(--text)]">Explore League Sites</h1>
            <p className="mt-3 text-[var(--muted)]">
              View live league headquarters to see the platform in action.
            </p>
          </div>

          <div className="space-y-4">
            {leagues.map((league) => (
              <Link
                key={league.slug}
                href={leagueUrl(league.slug)}
                className="league-card flex items-center gap-4 p-5 hover:border-[var(--accent)]/60 transition-colors"
              >
                {league.logoUrl ? (
                  <img src={league.logoUrl} alt="" className="w-12 h-12 rounded-lg object-contain" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center text-lg font-bold text-[var(--accent)]">
                    {league.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-bold text-[var(--text)]">{league.name}</h3>
                  <p className="text-sm text-[var(--muted)]">
                    {league.shortName || (league.foundedYear ? `Est. ${league.foundedYear}` : 'League site')}
                  </p>
                </div>
                <span className="text-sm font-bold text-[var(--accent)]">View →</span>
              </Link>
            ))}
          </div>

          <div className="mt-10 text-center">
            <p className="text-sm text-[var(--muted)]">
              Want your own league site?{' '}
              <Link href="/register" className="text-[var(--accent)] hover:underline font-medium">
                Get started here
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // No leagues at all - show setup message
  return (
    <div className="container mx-auto px-4 py-24">
      <div className="league-card mx-auto max-w-xl p-10 text-center">
        <p className="eyebrow">Demo</p>
        <h1 className="mt-3 text-3xl font-black text-[var(--text)]">Demo league coming soon</h1>
        <p className="mt-3 text-[var(--muted)]">
          No demo league is configured on this deployment yet. Reach out and we&apos;ll walk you through a live league site.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href={`mailto:${PLATFORM.contactEmail}`}
            className="inline-flex justify-center rounded-full bg-[var(--accent)] px-6 py-3 font-bold text-white"
            style={{ color: 'white' }}
          >
            Request a walkthrough
          </a>
          <Link href="/features" className="inline-flex justify-center rounded-full border border-[var(--border)] px-6 py-3 font-bold text-[var(--text)]">
            Explore features
          </Link>
        </div>
      </div>
    </div>
  );
}
