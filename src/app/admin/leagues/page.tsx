'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type User = { id: string; email: string; display_name: string | null; role: string };
type League = {
  id: string; slug: string; name: string; short_name: string | null; sleeper_league_id: string | null;
  setup_completed: boolean; is_active: boolean; founded_year: number | null; commissioner_user_id: string | null;
  commissioner_email: string | null; commissioner_name: string | null; roster_count: string | number; claimed_count: string | number;
};

export default function AdminLeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/leagues', { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (res.ok) { setLeagues(body.leagues || []); setUsers(body.users || []); }
    else setMessage(body.error || 'Could not load leagues');
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function update(leagueId: string, patch: Record<string, unknown>) {
    setMessage('');
    const res = await fetch('/api/admin/leagues', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ leagueId, ...patch }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) setMessage(body.error || 'Update failed');
    else { setMessage('League updated.'); await load(); }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.18em] text-amber-500">Platform Admin</p><h1 className="text-3xl font-black text-[var(--text)]">League Management</h1><p className="mt-1 text-sm text-[var(--muted)]">League status, commissioners, provider connections, membership, QA, and draft entry points.</p></div><div className="flex gap-2"><Link href="/setup?new=1" className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-bold text-white">Add League</Link><Link href="/admin" className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">Admin Home</Link></div></div>
      {message && <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--text)]">{message}</div>}
      {loading ? <p className="text-[var(--muted)]">Loading leagues…</p> : <div className="grid gap-4 lg:grid-cols-2">
        {leagues.map((league) => <section key={league.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="text-lg font-black text-[var(--text)]">{league.name}</h2><span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${league.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-500/10 text-[var(--muted)]'}`}>{league.is_active ? 'Active' : 'Inactive'}</span></div><p className="text-xs text-[var(--muted)]">{league.slug}{league.founded_year ? ` · Est. ${league.founded_year}` : ''}</p></div><div className="text-right text-xs text-[var(--muted)]"><div>{Number(league.claimed_count)} / {Number(league.roster_count)} claimed</div><div>{league.sleeper_league_id ? 'Sleeper connected' : 'Provider missing'}</div></div></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-[var(--muted)]">Commissioner account
              <select value={league.commissioner_user_id || ''} onChange={(e) => update(league.id, { commissionerUserId: e.target.value || null })} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-sm text-[var(--text)]">
                <option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.display_name || user.email}{user.role === 'admin' ? ' · Admin' : ''}</option>)}
              </select>
            </label>
            <div className="text-xs font-semibold text-[var(--muted)]">League availability
              <button onClick={() => update(league.id, { isActive: !league.is_active })} className={`mt-1 block w-full rounded-lg border px-3 py-2 text-left text-sm font-semibold ${league.is_active ? 'border-red-500/25 text-red-500' : 'border-emerald-500/25 text-emerald-500'}`}>{league.is_active ? 'Deactivate league' : 'Reactivate league'}</button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            {league.is_active && <Link href={`/l/${league.slug}`} className="rounded-lg border border-[var(--border)] px-3 py-2">Open League</Link>}
            <Link href={`/api/league/select?id=${encodeURIComponent(league.id)}&next=${encodeURIComponent('/settings')}`} className="rounded-lg border border-[var(--border)] px-3 py-2">League Settings</Link>
            <Link href={`/admin/qa?league=${encodeURIComponent(league.id)}`} className="rounded-lg border border-amber-500/30 px-3 py-2 text-amber-500">Test This League</Link>
            <Link href={`/admin/drafts?league=${encodeURIComponent(league.id)}`} className="rounded-lg border border-[var(--border)] px-3 py-2">Draft Administration</Link>
          </div>
        </section>)}
      </div>}
    </div>
  );
}
