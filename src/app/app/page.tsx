import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/server/auth';
import { getUserLeagues } from '@/lib/server/user-auth';
import { PLATFORM } from '@/lib/config/platform';
import MyLeaguesGrid from '@/components/dashboard/MyLeaguesGrid';

export const dynamic = 'force-dynamic';

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

  const userLeagues = await getUserLeagues(userId);
  const params = await searchParams;
  const showWelcome = params?.welcome === 'true';

  return (
    <div style={{ background: 'var(--brand-ink)' }} className="min-h-screen">
      {/* Welcome banner */}
      {showWelcome && (
        <div style={{ background: 'linear-gradient(160deg, var(--brand-navy) 0%, var(--brand-ink) 70%)' }} className="border-b border-white/10">
          <div className="container mx-auto px-4 py-8">
            <div className="flex items-start gap-5">
              <div className="flex-shrink-0 w-12 h-12 bg-[var(--brand-gold)]/15 border border-[var(--brand-gold)]/30 flex items-center justify-center text-2xl">
                🎉
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="block w-4 h-px bg-[var(--brand-gold)]" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--brand-gold)]">Welcome</span>
                </div>
                <h2 className="text-xl font-black text-white uppercase">Welcome to {PLATFORM.name}!</h2>
                <p className="mt-1 text-sm text-white/55">
                  Your account is ready. Join a league using an invite link from your commissioner, or create your own.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href="#my-leagues"
                    className="inline-flex items-center justify-center bg-[var(--brand-gold)] text-[var(--brand-ink)] px-4 py-2 text-xs font-black uppercase tracking-wider transition hover:brightness-110"
                  >
                    Get Started
                  </a>
                  <Link
                    href="/features"
                    className="inline-flex items-center justify-center border border-white/20 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider transition hover:bg-white/5"
                  >
                    Explore Features
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-10">
        <div id="my-leagues" className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h1 className="mt-2 text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">My Leagues</h1>
            <p className="mt-2 text-[var(--muted)]">
              Open your league sites, jump into your dashboards, and manage the leagues you run.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link
              href="/setup"
              className="inline-flex items-center justify-center bg-[var(--brand-gold)] text-[var(--brand-ink)] px-5 py-2.5 text-xs font-black uppercase tracking-wider transition hover:brightness-110"
            >
              Create League
            </Link>
            <a
              href={`mailto:${PLATFORM.contactEmail}`}
              className="inline-flex items-center justify-center border border-white/20 text-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition hover:bg-white/5"
            >
              Request Setup
            </a>
          </div>
        </div>

        <MyLeaguesGrid leagues={userLeagues} />
      </div>
    </div>
  );
}
