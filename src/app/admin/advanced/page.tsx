import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isUnderlyingPlatformAdminSession } from '@/lib/server/admin-auth';

export default async function AdvancedAdminPage() {
  if (!(await isUnderlyingPlatformAdminSession())) redirect('/login?next=/admin/advanced');
  const tools = [
    { href: '/admin/advanced/diagnostics', title: 'Diagnostics', desc: 'Database, environment, storage, provider, and integration checks.' },
    { href: '/admin/advanced/legacy-access', title: 'Legacy Team PINs', desc: 'Compatibility access for leagues that still use old team PIN authentication.' },
    { href: '/admin/draft', title: 'Legacy Draft Console', desc: 'Low-level draft configuration, media, pools, order, and commissioner controls.' },
    { href: '/admin/storage-test', title: 'Storage Test', desc: 'R2 upload smoke testing.' },
    { href: '/admin/model-controls', title: 'Model Controls', desc: 'AI and model configuration diagnostics.' },
    { href: '/admin/trades', title: 'Trade Utilities', desc: 'Legacy/manual trade administration.' },
    { href: '/admin/suggestions', title: 'Suggestion Moderation', desc: 'Review league suggestions and voting data.' },
    { href: '/admin/taxi', title: 'Legacy Taxi Utility', desc: 'League-specific compatibility tool. Not part of the reusable LeagueZone core.' },
  ];
  return <div className="mx-auto max-w-6xl px-4 py-8"><div className="mb-7 flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.18em] text-amber-500">Platform Admin</p><h1 className="text-3xl font-black text-[var(--text)]">Advanced Tools</h1><p className="mt-1 text-sm text-[var(--muted)]">Developer and compatibility utilities that should not dominate normal administration.</p></div><Link href="/admin" className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">Admin Home</Link></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{tools.map((tool) => <Link key={tool.href} href={tool.href} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 hover:border-[var(--accent)]"><h2 className="font-black text-[var(--text)]">{tool.title}</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{tool.desc}</p></Link>)}</div></div>;
}
