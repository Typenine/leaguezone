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
      <div style={{ background: 'var(--brand-ink)' }} className="min-h-screen">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <div className="flex items-center justify-center gap-3 mb-3">
                <span className="block w-6 h-px bg-[var(--brand-gold)]" />
                <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--brand-gold)]">Demo</span>
                <span className="block w-6 h-px bg-[var(--brand-gold)]" />
              </div>
              <h1 className="text-3xl font-black uppercase tracking-tight text-white">Explore League Sites</h1>
              <p className="mt-3 text-white/50">
                View live league headquarters to see the platform in action.
              </p>
            </div>

            <div className="space-y-3">
              {leagues.map((league) => (
                <Link
                  key={league.slug}
                  href={leagueUrl(league.slug)}
                  style={{ background: '#0d1422', borderTop: '2px solid rgba(192,168,74,0.35)' }}
                  className="flex items-center gap-4 p-5 group border border-white/8 hover:border-[var(--brand-gold)]/50 transition-colors"
                >
                  {league.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={league.logoUrl} alt="" className="w-12 h-12 object-contain" />
                  ) : (
                    <div className="w-12 h-12 bg-[var(--brand-gold)]/10 border border-[var(--brand-gold)]/20 flex items-center justify-center text-sm font-black text-[var(--brand-gold)]">
                      {league.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-black uppercase tracking-wide text-white text-sm">{league.name}</h3>
                    <p className="text-xs text-white/45 mt-0.5">
                      {league.shortName || (league.foundedYear ? `Est. ${league.foundedYear}` : 'League site')}
                    </p>
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider text-[var(--brand-gold)] opacity-0 group-hover:opacity-100 transition-opacity">View →</span>
                </Link>
              ))}
            </div>

            <div className="mt-10 text-center">
              <p className="text-sm text-white/40">
                Want your own league site?{' '}
                <Link href="/register" className="text-[var(--brand-gold)] hover:underline font-bold">
                  Get started here
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--brand-ink)' }} className="min-h-screen flex items-center justify-center py-24 px-4">
      <div style={{ background: '#0d1422', borderTop: '2px solid rgba(192,168,74,0.35)' }} className="mx-auto max-w-xl p-10 text-center border border-white/8">
        <div className="flex items-center justify-center gap-3 mb-3">
          <span className="block w-6 h-px bg-[var(--brand-gold)]" />
          <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--brand-gold)]">Demo</span>
          <span className="block w-6 h-px bg-[var(--brand-gold)]" />
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-white">Demo league coming soon</h1>
        <p className="mt-3 text-white/50">
          No demo league is configured on this deployment yet. Reach out and we&apos;ll walk you through a live league site.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href={`mailto:${PLATFORM.contactEmail}`}
            className="inline-flex justify-center bg-[var(--brand-gold)] text-[var(--brand-ink)] px-6 py-3 text-xs font-black uppercase tracking-wider transition hover:brightness-110"
          >
            Request a walkthrough
          </a>
          <Link href="/features" className="inline-flex justify-center border border-white/20 text-white px-6 py-3 text-xs font-bold uppercase tracking-wider transition hover:bg-white/5">
            Explore features
          </Link>
        </div>
      </div>
    </div>
  );
}
