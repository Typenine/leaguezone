import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { isUnderlyingPlatformAdminSession } from '@/lib/server/admin-auth';

export const dynamic = 'force-dynamic';

export default async function DiagnosticsPage() {
  if (!(await isUnderlyingPlatformAdminSession())) redirect('/login?next=/admin/advanced/diagnostics');
  let tables: string[] = [];
  try {
    const res = await getDb().execute(sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`);
    tables = ((res as { rows?: Array<{ tablename: string }> }).rows ?? []).map((row) => row.tablename);
  } catch {}
  const checks = [
    ['Database connection', tables.length > 0],
    ['AUTH_SECRET', Boolean(process.env.AUTH_SECRET)],
    ['Upstash Redis', Boolean(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)],
    ['Resend', Boolean(process.env.RESEND_API_KEY)],
    ['Cloudflare R2', Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY)],
    ['Groq', Boolean(process.env.GROQ_API_KEY)],
  ] as const;
  return <div className="mx-auto max-w-5xl px-4 py-8"><div className="mb-6 flex justify-between gap-3"><div><h1 className="text-3xl font-black text-[var(--text)]">Diagnostics</h1><p className="text-sm text-[var(--muted)]">Read-only platform configuration and database checks.</p></div><Link href="/admin/advanced" className="text-sm text-[var(--accent)]">Advanced Tools</Link></div><div className="grid gap-3 sm:grid-cols-2">{checks.map(([label, ok]) => <div key={label} className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm"><span>{label}</span><span className={ok ? 'font-black text-emerald-500' : 'font-black text-red-500'}>{ok ? 'OK' : 'Missing'}</span></div>)}</div><details className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><summary className="cursor-pointer text-sm font-bold">Database tables ({tables.length})</summary><p className="mt-3 break-words font-mono text-xs leading-6 text-[var(--muted)]">{tables.join(' · ')}</p></details></div>;
}
