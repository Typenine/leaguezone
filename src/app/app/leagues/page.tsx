import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/server/auth';
import { getUserLeagues } from '@/lib/server/user-auth';
import MyLeaguesGrid from '@/components/dashboard/MyLeaguesGrid';

export const dynamic = 'force-dynamic';

export default async function AppLeaguesPage() {
  const cookieJar = await cookies();
  const sessionToken = cookieJar.get('evw_session')?.value || '';
  const claims = sessionToken ? verifySession(sessionToken) : null;
  const userId = claims?.type === 'user' && typeof claims.sub === 'string' ? claims.sub : null;
  if (!userId) redirect('/login?next=/app/leagues');

  const userLeagues = await getUserLeagues(userId);

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-8">
        <p className="eyebrow">Dashboard</p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[var(--text)] sm:text-4xl">My Leagues</h1>
        <p className="mt-2 text-[var(--muted)]">All the leagues connected to your account.</p>
      </div>

      <MyLeaguesGrid leagues={userLeagues} />
    </div>
  );
}
