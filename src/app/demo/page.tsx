import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentLeagueBySlug } from '@/lib/server/league-context';
import { getAllLeagues } from '@/lib/server/league-config';
import { DEFAULT_LEAGUE_SLUG, PLATFORM, leagueUrl } from '@/lib/config/platform';

export const dynamic = 'force-dynamic';

/**
 * Public demo entry point. Sends visitors to the default demo league
 * (east-v-west) when it exists, falls back to the first active league,
 * and shows a landing message when no league is configured yet.
 */
export default async function DemoPage() {
  const demoLeague = await getCurrentLeagueBySlug(DEFAULT_LEAGUE_SLUG);
  if (demoLeague) redirect(leagueUrl(demoLeague.slug));

  const leagues = await getAllLeagues();
  if (leagues.length > 0) redirect(leagueUrl(leagues[0].slug));

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
