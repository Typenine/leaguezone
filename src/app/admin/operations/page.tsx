import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { isUnderlyingPlatformAdminSession } from '@/lib/server/admin-auth';
import { ensureQaSessionsTable } from '@/lib/server/qa-session';

export const dynamic = 'force-dynamic';

export default async function AdminOperationsPage() {
  if (!(await isUnderlyingPlatformAdminSession())) redirect('/login?next=/admin/operations');
  await ensureQaSessionsTable();
  const db = getDb();
  const [leaguesRes, usersRes, qaRes] = await Promise.all([
    db.execute(sql`SELECT name, slug, sleeper_league_id, commissioner_user_id, setup_completed, is_active, updated_at FROM leagues ORDER BY name`),
    db.execute(sql`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE email_verified = false) AS unverified FROM users`),
    db.execute(sql`SELECT COUNT(*) AS active FROM qa_sessions WHERE active = true AND expires_at > now()`),
  ]);
  const leagues = (leaguesRes as { rows?: Array<Record<string, unknown>> }).rows ?? [];
  const userRow = (usersRes as { rows?: Array<Record<string, unknown>> }).rows?.[0] || {};
  const qaRow = (qaRes as { rows?: Array<Record<string, unknown>> }).rows?.[0] || {};
  const integrations = [
    ['Database', Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL)],
    ['Upstash rate limiting', Boolean(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)],
    ['Resend email', Boolean(process.env.RESEND_API_KEY)],
    ['R2 storage', Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY)],
    ['Groq AI', Boolean(process.env.GROQ_API_KEY)],
    ['Auth signing secret', Boolean(process.env.AUTH_SECRET)],
  ] as const;
  const problems = leagues.flatMap((league) => [
    ...(!league.sleeper_league_id && league.is_active ? [`${league.name}: no Sleeper league connected`] : []),
    ...(!league.commissioner_user_id && league.is_active ? [`${league.name}: no commissioner account assigned`] : []),
    ...(!league.setup_completed ? [`${league.name}: setup incomplete`] : []),
  ]);

  return <div className="mx-auto max-w-6xl px-4 py-8"><div className="mb-7 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.18em] text-amber-500">Platform Admin</p><h1 className="text-3xl font-black text-[var(--text)]">Platform Operations</h1><p className="mt-1 text-sm text-[var(--muted)]">Operational state that affects real users: integrations, league setup, email, auth, and QA activity.</p></div><Link href="/admin" className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">Admin Home</Link></div><div className="grid gap-5 lg:grid-cols-2"><section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-black text-[var(--text)]">Integrations</h2><div className="mt-4 space-y-2">{integrations.map(([name, ok]) => <div key={name} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm"><span>{name}</span><span className={ok ? 'font-bold text-emerald-500' : 'font-bold text-red-500'}>{ok ? 'Configured' : 'Missing'}</span></div>)}</div></section><section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-black text-[var(--text)]">Needs Attention</h2><div className="mt-4 space-y-2">{problems.length === 0 && Number(userRow.unverified || 0) === 0 ? <p className="text-sm text-[var(--muted)]">No setup warnings detected.</p> : <>{problems.map((problem) => <div key={problem} className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm">{problem}</div>)}{Number(userRow.unverified || 0) > 0 && <Link href="/admin/users" className="block rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm">{Number(userRow.unverified)} unverified account(s)</Link>}</>}</div></section></div><section className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><div className="grid grid-cols-2 gap-4 sm:grid-cols-4"><div><div className="text-2xl font-black">{leagues.filter((league) => league.is_active).length}</div><div className="text-xs uppercase text-[var(--muted)]">Active leagues</div></div><div><div className="text-2xl font-black">{Number(userRow.total || 0)}</div><div className="text-xs uppercase text-[var(--muted)]">Accounts</div></div><div><div className="text-2xl font-black">{Number(qaRow.active || 0)}</div><div className="text-xs uppercase text-[var(--muted)]">QA sessions</div></div><div><div className="truncate text-sm font-black">{process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local'}</div><div className="text-xs uppercase text-[var(--muted)]">Version</div></div></div></section></div>;
}
