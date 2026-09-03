import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAllLeagues } from '@/lib/server/league-config';
import { isPlatformAdminSession } from '@/lib/server/admin-auth';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { SwitchLeagueButton, DedupInvitesButton, DeleteLeagueButton } from './SuperAdminClient';

export const dynamic = 'force-dynamic';

async function getMemberCounts(): Promise<Record<string, { total: number; claimed: number }>> {
  try {
    const db = getDb();
    const res = await db.execute(sql`
      WITH ranked AS (
        SELECT
          league_id::text AS league_id,
          claimed_at,
          ROW_NUMBER() OVER (
            PARTITION BY league_id, COALESCE(roster_id::text, team_name)
            ORDER BY claimed_at DESC NULLS LAST, created_at ASC
          ) AS rn
        FROM league_invites
      )
      SELECT
        league_id,
        COUNT(*) FILTER (WHERE rn = 1) AS total,
        COUNT(*) FILTER (WHERE rn = 1 AND claimed_at IS NOT NULL) AS claimed
      FROM ranked
      GROUP BY league_id
    `);
    const rows = (res as { rows?: Array<Record<string, unknown>> }).rows ?? [];
    const out: Record<string, { total: number; claimed: number }> = {};
    for (const r of rows) {
      out[r.league_id as string] = {
        total: Number(r.total),
        claimed: Number(r.claimed),
      };
    }
    return out;
  } catch {
    return {};
  }
}

export default async function SuperAdminPage() {
  if (!(await isPlatformAdminSession())) {
    redirect('/super-admin/login?next=/super-admin');
  }

  const [leagues, memberCounts] = await Promise.all([
    getAllLeagues(),
    getMemberCounts(),
  ]);

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">🌐</span>
            <h1 className="text-3xl font-bold text-[var(--text)]">Platform Admin</h1>
          </div>
          <p className="text-[var(--muted)] text-sm">Global administration for LeagueZone leagues and testing tools.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin" className="px-3 py-2 rounded-lg border border-amber-500/40 text-sm text-amber-500 hover:bg-amber-500/10 transition-colors">Admin Dashboard</Link>
          <Link href="/" className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--muted)] hover:text-[var(--text)] transition-colors">← Website Hub</Link>
        </div>
      </div>

      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[var(--text)] text-lg">Leagues</h2>
          <Link href="/setup?new=1" className="text-sm px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity">+ Add League</Link>
        </div>

        {leagues.length === 0 ? (
          <div className="text-[var(--muted)] text-sm border border-[var(--border)] rounded-xl p-6 text-center">
            No leagues found.{' '}
            <Link href="/setup" className="text-[var(--accent)] hover:underline">Set up your first league →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {leagues.map((league) => {
              const counts = memberCounts[league.id] ?? { total: 0, claimed: 0 };
              return (
                <div key={league.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <div className="flex items-start gap-3 mb-3">
                    {league.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={league.logoUrl} alt={league.name} className="w-10 h-10 rounded-lg object-contain border border-[var(--border)] flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-[var(--surface-strong)] flex items-center justify-center text-xl flex-shrink-0">🏈</div>
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold text-[var(--text)] truncate">{league.name}</div>
                      {league.shortName && <div className="text-xs text-[var(--muted)]">{league.shortName}</div>}
                      {league.foundedYear && <div className="text-xs text-[var(--muted)]">Est. {league.foundedYear}</div>}
                    </div>
                  </div>

                  {(league.primaryColor || league.secondaryColor) && (
                    <div className="flex gap-2 mb-3">
                      {league.primaryColor && <div className="w-5 h-5 rounded-full border border-[var(--border)]" style={{ backgroundColor: league.primaryColor }} title={`Primary: ${league.primaryColor}`} />}
                      {league.secondaryColor && <div className="w-5 h-5 rounded-full border border-[var(--border)]" style={{ backgroundColor: league.secondaryColor }} title={`Secondary: ${league.secondaryColor}`} />}
                    </div>
                  )}

                  <div className="text-xs text-[var(--muted)] mb-4">{counts.claimed} / {counts.total} members signed up</div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <SwitchLeagueButton leagueId={league.id} leagueName={league.name} destination="/home" />
                    <SwitchLeagueButton leagueId={league.id} leagueName={league.name} destination="/settings" label="Settings" variant="secondary" />
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <DedupInvitesButton leagueId={league.id} />
                    <DeleteLeagueButton leagueId={league.id} leagueName={league.name} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold text-[var(--text)] text-lg mb-4">Global Tools</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { href: '/admin/tools', icon: '🔧', label: 'QA & Testing' },
            { href: '/admin/users', icon: '👤', label: 'User Management' },
            { href: '/setup', icon: '⚙️', label: 'Setup Wizard' },
            { href: '/admin/suggestions', icon: '💡', label: 'Suggestions' },
            { href: '/newsletter', icon: '📧', label: 'Newsletter' },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/60 transition-all text-center">
              <div className="text-2xl mb-1">{item.icon}</div>
              <div className="text-sm font-medium text-[var(--text)]">{item.label}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
