import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/server/auth';
import { getUserById, getUserLeagues, type UserLeague } from '@/lib/server/user-auth';
import { PLATFORM, leagueUrl } from '@/lib/config/platform';
import MyLeaguesGrid from '@/components/dashboard/MyLeaguesGrid';
import LeagueWebsiteSearch from '@/components/LeagueWebsiteSearch';

export const dynamic = 'force-dynamic';

function selectedLeagueHref(leagueId: string, next: string): string {
  return `/api/league/select?id=${encodeURIComponent(leagueId)}&next=${encodeURIComponent(next)}`;
}

function ActiveLeagueCard({ league }: { league: UserLeague }) {
  return (
    <div className="border border-white/15 bg-white/[0.04] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[var(--brand-gold)]">Continue your league</p>
          <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-white">{league.leagueName}</h2>
          <p className="mt-1 text-sm text-white/50">
            {league.teamName}{league.isCommissioner ? ' · Commissioner' : ''}
          </p>
        </div>
        <span className="border border-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white/45">Active league</span>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href={leagueUrl(league.leagueSlug)}
          className="inline-flex items-center justify-center bg-[var(--brand-gold)] px-5 py-2.5 text-xs font-black uppercase tracking-wider text-[var(--brand-ink)] transition hover:brightness-110"
        >
          Open League Site
        </Link>
        <a
          href={selectedLeagueHref(league.leagueId, '/home')}
          className="inline-flex items-center justify-center border border-white/25 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/5"
        >
          League Dashboard
        </a>
        {league.isCommissioner && (
          <a
            href={selectedLeagueHref(league.leagueId, `/l/${league.leagueSlug}/admin`)}
            className="inline-flex items-center justify-center border border-[var(--brand-gold)]/40 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[var(--brand-gold)] transition hover:bg-white/5"
          >
            Commissioner Settings
          </a>
        )}
      </div>
    </div>
  );
}

export default async function AppDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ welcome?: string }>;
}) {
  const cookieJar = await cookies();
  const sessionToken = cookieJar.get('evw_session')?.value || '';
  const claims = sessionToken ? verifySession(sessionToken) : null;
  const userId = claims?.type === 'user' && typeof claims.sub === 'string' ? claims.sub : null;
  if (!userId) redirect('/login?next=/app');

  const [userLeagues, user] = await Promise.all([
    getUserLeagues(userId),
    getUserById(userId),
  ]);
  const params = await searchParams;
  const showWelcome = params?.welcome === 'true';
  const activeLeagueId = cookieJar.get('active_league_id')?.value || '';
  const activeLeague = userLeagues.find((league) => league.leagueId === activeLeagueId) || userLeagues[0] || null;
  const commissionerCount = userLeagues.filter((league) => league.isCommissioner).length;
  const displayName = user?.displayName?.trim() || user?.email?.split('@')[0] || 'there';

  return (
    <div style={{ background: 'var(--brand-ink)' }} className="min-h-screen">
      <section
        style={{ background: 'linear-gradient(160deg, var(--brand-navy) 0%, var(--brand-ink) 72%)' }}
        className="border-b border-white/10"
      >
        <div className="container mx-auto px-4 py-10 sm:py-14">
          {showWelcome && (
            <div className="mb-6 border border-[var(--brand-gold)]/30 bg-[var(--brand-gold)]/10 px-4 py-3 text-sm text-white/70">
              Your account is ready. Join an existing league or create a new LeagueZone site below.
            </div>
          )}

          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <div className="flex items-center gap-3">
                <span className="block h-px w-7 bg-[var(--brand-gold)]" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--brand-gold)]">LeagueZone Home</p>
              </div>
              <h1 className="mt-4 text-4xl font-black uppercase leading-none tracking-tighter text-white sm:text-5xl">
                Welcome back, {displayName}.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-white/55 sm:text-lg">
                {activeLeague
                  ? 'Return to your active league, switch to another league, or handle commissioner work without going through the public sales site.'
                  : 'Your account is ready. Join a league with an invite or create a new league site to get started.'}
              </p>
              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold uppercase tracking-wider">
                <Link href="/setup" className="text-[var(--brand-gold)] hover:underline">Create League</Link>
                <a href="#join-league" className="text-white/60 hover:text-white">Join League</a>
                <Link href="/?view=public" className="text-white/40 hover:text-white">View Public Site</Link>
              </div>
            </div>

            {activeLeague ? (
              <ActiveLeagueCard league={activeLeague} />
            ) : (
              <div className="border border-dashed border-white/20 bg-white/[0.025] p-6">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[var(--brand-gold)]">No league linked yet</p>
                <h2 className="mt-2 text-2xl font-black uppercase text-white">Choose your next step</h2>
                <p className="mt-2 text-sm leading-6 text-white/50">
                  Use an invite from your commissioner, search for a hosted league, or create a league you will manage.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <a href="#join-league" className="bg-[var(--brand-gold)] px-5 py-2.5 text-xs font-black uppercase tracking-wider text-[var(--brand-ink)]">Join a League</a>
                  <Link href="/setup" className="border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white">Create League</Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="container mx-auto space-y-12 px-4 py-10 sm:py-12">
        {userLeagues.length > 0 && (
          <section aria-labelledby="my-leagues-heading">
            <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="eyebrow">Your account</p>
                <h2 id="my-leagues-heading" className="mt-2 text-3xl font-black uppercase tracking-tight text-white">My Leagues</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {userLeagues.length} {userLeagues.length === 1 ? 'league' : 'leagues'} linked
                  {commissionerCount > 0 ? ` · ${commissionerCount} commissioner ${commissionerCount === 1 ? 'role' : 'roles'}` : ''}
                </p>
              </div>
              <Link href="/app/leagues" className="text-xs font-black uppercase tracking-wider text-[var(--brand-gold)] hover:underline">
                Manage All Leagues →
              </Link>
            </div>
            <MyLeaguesGrid leagues={userLeagues} />
          </section>
        )}

        <section id="join-league" aria-labelledby="join-league-heading">
          <div className="mb-5">
            <p className="eyebrow">League access</p>
            <h2 id="join-league-heading" className="mt-2 text-2xl font-black uppercase tracking-tight text-white">
              {userLeagues.length > 0 ? 'Join Another League' : 'Find or Join Your League'}
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Search with a Sleeper league ID or use the invite code supplied by your commissioner.
            </p>
          </div>
          <LeagueWebsiteSearch />
        </section>

        {userLeagues.length === 0 && (
          <section aria-labelledby="onboarding-heading">
            <div className="mb-5">
              <p className="eyebrow">Getting started</p>
              <h2 id="onboarding-heading" className="mt-2 text-2xl font-black uppercase tracking-tight text-white">No leagues yet</h2>
            </div>
            <MyLeaguesGrid leagues={[]} />
          </section>
        )}

        <section className="grid gap-3 border-t border-white/10 pt-8 sm:grid-cols-3" aria-label="Account shortcuts">
          <Link href="/setup" className="border border-white/10 bg-white/[0.03] p-5 transition hover:border-[var(--brand-gold)]/40 hover:bg-white/[0.05]">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--brand-gold)]">Create</p>
            <h3 className="mt-2 font-black uppercase text-white">New League Site</h3>
            <p className="mt-2 text-sm leading-6 text-white/45">Connect and configure another fantasy league.</p>
          </Link>
          <Link href="/settings" className="border border-white/10 bg-white/[0.03] p-5 transition hover:border-[var(--brand-gold)]/40 hover:bg-white/[0.05]">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--brand-gold)]">Account</p>
            <h3 className="mt-2 font-black uppercase text-white">Settings</h3>
            <p className="mt-2 text-sm leading-6 text-white/45">Manage your team identity, account, and password.</p>
          </Link>
          <a href={`mailto:${PLATFORM.contactEmail}`} className="border border-white/10 bg-white/[0.03] p-5 transition hover:border-[var(--brand-gold)]/40 hover:bg-white/[0.05]">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--brand-gold)]">Support</p>
            <h3 className="mt-2 font-black uppercase text-white">Get Help</h3>
            <p className="mt-2 text-sm leading-6 text-white/45">Contact LeagueZone about setup or account access.</p>
          </a>
        </section>
      </div>
    </div>
  );
}
