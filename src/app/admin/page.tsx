import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql, type SQL } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { isUnderlyingPlatformAdminSession } from '@/lib/server/admin-auth';

export const dynamic = 'force-dynamic';

async function countRows(query: SQL): Promise<number> {
  try {
    const res = await getDb().execute(query);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    return Number(row?.count || 0);
  } catch { return 0; }
}

export default async function AdminHubPage() {
  if (!(await isUnderlyingPlatformAdminSession())) redirect('/login?next=/admin');
  const db = getDb();
  const [leagueCount, userCount, unverifiedCount, activeQaCount, draftCount, attentionRes, recentUsersRes, recentClaimsRes] = await Promise.all([
    countRows(sql`SELECT COUNT(*) AS count FROM leagues WHERE is_active = true`),
    countRows(sql`SELECT COUNT(*) AS count FROM users`),
    countRows(sql`SELECT COUNT(*) AS count FROM users WHERE email_verified = false`),
    countRows(sql`SELECT COUNT(*) AS count FROM qa_sessions WHERE active = true AND expires_at > now()`),
    countRows(sql`SELECT COUNT(*) AS count FROM drafts WHERE environment = 'live' AND archived_at IS NULL`).catch(() => 0),
    db.execute(sql`
      SELECT id::text, slug, name, sleeper_league_id, commissioner_user_id::text,
             setup_completed, is_active
      FROM leagues
      WHERE is_active = true
      ORDER BY created_at ASC
    `),
    db.execute(sql`SELECT email, display_name, email_verified, created_at FROM users ORDER BY created_at DESC LIMIT 5`),
    db.execute(sql`
      SELECT li.claimed_at, li.team_name, l.name AS league_name, u.display_name, u.email
      FROM league_invites li
      JOIN leagues l ON l.id = li.league_id
      LEFT JOIN users u ON u.id = li.claimed_by
      WHERE li.claimed_at IS NOT NULL
      ORDER BY li.claimed_at DESC LIMIT 5
    `),
  ]);
  const leagueRows = (attentionRes as { rows?: Array<Record<string, unknown>> }).rows ?? [];
  const attention = [
    ...leagueRows.filter((row) => !row.sleeper_league_id).map((row) => ({ text: `${row.name} has no provider league connected`, href: '/admin/leagues' })),
    ...leagueRows.filter((row) => !row.commissioner_user_id).map((row) => ({ text: `${row.name} has no commissioner account assigned`, href: '/admin/leagues' })),
    ...(unverifiedCount > 0 ? [{ text: `${unverifiedCount} account${unverifiedCount === 1 ? '' : 's'} still need email verification`, href: '/admin/users' }] : []),
  ].slice(0, 6);
  const recentUsers = (recentUsersRes as { rows?: Array<Record<string, unknown>> }).rows ?? [];
  const recentClaims = (recentClaimsRes as { rows?: Array<Record<string, unknown>> }).rows ?? [];

  const primary = [
    { href: '/admin/qa', title: 'Test as a User', desc: 'Enter a league as public, member, team, or commissioner. Run isolated draft rehearsals.', badge: activeQaCount ? `${activeQaCount} active` : 'QA Mode' },
    { href: '/admin/leagues', title: 'League Management', desc: 'Hosted leagues, commissioners, provider connections, membership, and league status.', badge: `${leagueCount} leagues` },
    { href: '/admin/users', title: 'Users & Access', desc: 'Accounts, verification, league memberships, and platform-admin permissions.', badge: `${userCount} users` },
    { href: '/admin/drafts', title: 'Draft Administration', desc: 'Create future drafts, manage live drafts, rehearse workflows, and archive completed drafts.', badge: `${draftCount} live` },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-500">Platform Admin</p>
          <h1 className="text-3xl font-black text-[var(--text)]">LeagueZone Control Center</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Operate leagues, accounts, drafts, QA sessions, and platform health from one place.</p>
        </div>
        <Link href="/" className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">LeagueZone Home</Link>
      </div>

      <div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[[leagueCount, 'Leagues'], [userCount, 'Users'], [attention.length, 'Needs Attention'], [activeQaCount, 'Active QA']].map(([value, label]) => (
          <div key={String(label)} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="text-2xl font-black text-[var(--text)]">{value}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {primary.map((item, index) => (
          <Link key={item.href} href={item.href} className={`rounded-2xl border p-5 transition hover:-translate-y-0.5 ${index === 0 ? 'border-amber-500/40 bg-amber-500/5' : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]'}`}>
            <div className="mb-5 text-xs font-black uppercase tracking-wide text-[var(--muted)]">{item.badge}</div>
            <h2 className="text-lg font-black text-[var(--text)]">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.desc}</p>
          </Link>
        ))}
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between gap-3"><h2 className="font-black text-[var(--text)]">Needs Attention</h2><Link href="/admin/operations" className="text-xs font-semibold text-[var(--accent)]">Platform Operations</Link></div>
          <div className="mt-4 space-y-2">
            {attention.length === 0 ? <p className="text-sm text-[var(--muted)]">No account or league setup warnings detected.</p> : attention.map((item) => (
              <Link key={item.text} href={item.href} className="block rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-sm text-[var(--text)] hover:border-amber-500/40">{item.text}</Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="font-black text-[var(--text)]">Recent Activity</h2>
          <div className="mt-4 space-y-3 text-sm">
            {recentClaims.slice(0, 3).map((row, index) => <div key={`claim-${index}`}><p className="text-[var(--text)]"><span className="font-semibold">{String(row.display_name || row.email || 'User')}</span> claimed {String(row.team_name)} in {String(row.league_name)}</p><p className="text-xs text-[var(--muted)]">{new Date(row.claimed_at as string | Date).toLocaleString()}</p></div>)}
            {recentUsers.slice(0, 3).map((row, index) => <div key={`user-${index}`}><p className="text-[var(--text)]"><span className="font-semibold">{String(row.display_name || row.email)}</span> registered</p><p className="text-xs text-[var(--muted)]">{new Date(row.created_at as string | Date).toLocaleString()}</p></div>)}
            {recentClaims.length === 0 && recentUsers.length === 0 && <p className="text-[var(--muted)]">No recent activity.</p>}
          </div>
        </section>
      </div>

      <div className="mt-7 flex flex-wrap gap-3 text-sm">
        <Link href="/admin/operations" className="rounded-lg border border-[var(--border)] px-3 py-2 font-semibold">Platform Operations</Link>
        <Link href="/admin/advanced" className="rounded-lg border border-[var(--border)] px-3 py-2 font-semibold text-[var(--muted)]">Advanced Tools</Link>
      </div>
    </div>
  );
}
