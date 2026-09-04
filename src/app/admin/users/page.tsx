'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Membership = { league_id: string; league_name: string; league_slug: string; team_name: string; roster_id: number | null; is_commissioner: boolean };
type User = { id: string; email: string; display_name: string | null; role: 'admin' | 'user'; email_verified: boolean; created_at: string; memberships: Membership[] };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentAdmin, setCurrentAdmin] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/users', { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (res.ok) { setUsers(body.users || []); setCurrentAdmin(body.currentAdminUserId || ''); }
    else setMessage(body.error || 'Could not load users');
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => `${user.email} ${user.display_name || ''} ${user.memberships.map((m) => `${m.league_name} ${m.team_name}`).join(' ')}`.toLowerCase().includes(q));
  }, [users, query]);

  async function setRole(user: User, role: 'admin' | 'user') {
    if (role === 'admin' && !confirm(`Give ${user.display_name || user.email} platform-admin access to all LeagueZone leagues?`)) return;
    if (role === 'user' && !confirm(`Remove platform-admin access from ${user.display_name || user.email}?`)) return;
    const res = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: user.id, role }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) setMessage(body.error || 'Role update failed');
    else { setMessage('Access updated.'); await load(); }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.18em] text-amber-500">Platform Admin</p><h1 className="text-3xl font-black text-[var(--text)]">Users & Access</h1><p className="mt-1 text-sm text-[var(--muted)]">Account verification, league memberships, commissioner status, and platform permissions.</p></div><Link href="/admin" className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">Admin Home</Link></div>
      <div className="mb-5 flex flex-wrap gap-3"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search email, name, team, or league…" className="min-w-[260px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text)]"/><Link href="/admin/advanced/legacy-access" className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--muted)]">Legacy Team PINs</Link></div>
      {message && <p className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">{message}</p>}
      {loading ? <p className="text-[var(--muted)]">Loading users…</p> : <div className="space-y-3">
        {filtered.map((user) => <section key={user.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-black text-[var(--text)]">{user.display_name || user.email}</h2>{user.role === 'admin' && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase text-amber-500">Platform Admin</span>}<span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${user.email_verified ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>{user.email_verified ? 'Verified' : 'Unverified'}</span></div><p className="text-sm text-[var(--muted)]">{user.email}</p><p className="mt-1 text-xs text-[var(--muted)]">Joined {new Date(user.created_at).toLocaleDateString()}</p></div><div>{user.role === 'admin' ? <button disabled={user.id === currentAdmin} onClick={() => setRole(user, 'user')} className="rounded-lg border border-red-500/25 px-3 py-2 text-xs font-semibold text-red-500 disabled:opacity-40">Remove Admin</button> : <button onClick={() => setRole(user, 'admin')} className="rounded-lg border border-amber-500/30 px-3 py-2 text-xs font-semibold text-amber-500">Make Platform Admin</button>}</div></div>
          <div className="mt-4 flex flex-wrap gap-2">{user.memberships.length === 0 ? <span className="text-xs text-[var(--muted)]">No league memberships</span> : user.memberships.map((membership) => <Link key={`${membership.league_id}-${membership.team_name}`} href={`/l/${membership.league_slug}`} className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text)]"><span className="font-semibold">{membership.league_name}</span> · {membership.team_name}{membership.is_commissioner ? ' · Commissioner' : ''}</Link>)}</div>
        </section>)}
      </div>}
    </div>
  );
}
