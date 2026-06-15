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
  searchParams?: { welcome?: string };
}) {
  const cookieJar = await cookies();
  const sessionToken = cookieJar.get('evw_session')?.value || '';
  const claims = sessionToken ? verifySession(sessionToken) : null;
  const userId = claims?.type === 'user' && typeof claims.sub === 'string' ? claims.sub : null;
  if (!userId) redirect('/login?next=/app');

  const userLeagues = await getUserLeagues(userId);
  const showWelcome = searchParams?.welcome === 'true';

  return (
    <div className="container mx-auto px-4 py-10">
      {/* Welcome banner for new users */}
      {showWelcome && (
        <div className="mb-8 bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[var(--accent)] flex items-center justify-center text-2xl">
              🎉
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-[var(--text)]">Welcome to {PLATFORM.name}!</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Your account is ready. To get started, join an existing league using an invite link from your commissioner, 
                or create your own league if you&apos;re a commissioner.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href="#my-leagues"
                  className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
                >
                  Get Started Below
                </a>
                <Link
                  href="/features"
                  className="inline-flex items-center justify-center rounded-full border border-[var(--border)] px-4 py-2 text-sm font-bold text-[var(--text)] transition hover:border-[var(--accent)]/60"
                >
                  Explore Features
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <div id="my-leagues" className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[var(--text)] sm:text-4xl">My Leagues</h1>
          <p className="mt-2 text-[var(--muted)]">
            Open your league sites, jump into your dashboards, and manage the leagues you run.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/setup"
            className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
            style={{ color: 'white' }}
          >
            Create League
          </Link>
          <a
            href={`mailto:${PLATFORM.contactEmail}`}
            className="inline-flex items-center justify-center rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-bold text-[var(--text)] transition hover:border-[var(--accent)]/60"
          >
            Request Setup
          </a>
        </div>
      </div>

      <MyLeaguesGrid leagues={userLeagues} />
    </div>
  );
}
