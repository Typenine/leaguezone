'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

type League = { id: string; slug: string; name: string };
type Draft = { id: string; leagueId: string; year: number; rounds: number; clockSeconds: number; status: string; environment: 'live' | 'rehearsal'; qaSessionId: string | null; archivedAt: string | null; createdAt: string; completedAt: string | null };
type Payload = { leagues: League[]; drafts: Record<string, Draft[]> };

export default function AdminDraftsPage() {
  const search = useSearchParams();
  const requestedLeague = search.get('league') || '';
  const [data, setData] = useState<Payload>({ leagues: [], drafts: {} });
  const [leagueId, setLeagueId] = useState(requestedLeague);
  const [year, setYear] = useState(String(new Date().getFullYear() + 1));
  const [rounds, setRounds] = useState('4');
  const [clockSeconds, setClockSeconds] = useState('60');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/drafts', { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (res.ok) setData(body as Payload); else setMessage(body.error || 'Could not load drafts');
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!leagueId && data.leagues.length) setLeagueId(data.leagues[0].id); }, [data.leagues, leagueId]);
  const league = useMemo(() => data.leagues.find((item) => item.id === leagueId), [data.leagues, leagueId]);
  const drafts = data.drafts[leagueId] || [];
  const liveDrafts = drafts.filter((draft) => draft.environment === 'live');
  const rehearsalCount = drafts.filter((draft) => draft.environment === 'rehearsal').length;

  async function action(body: Record<string, unknown>) {
    setSaving(true); setMessage('');
    const res = await fetch('/api/admin/drafts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const result = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setMessage(result.error || 'Draft action failed'); return false; }
    await load(); return true;
  }
  async function create() {
    const ok = await action({ action: 'create', leagueId, year: Number(year), rounds: Number(rounds), clockSeconds: Number(clockSeconds) });
    if (ok) setMessage(`${year} draft created. It is independent of Sleeper and ready for setup.`);
  }
  async function openDraft(draft: Draft, destination: '/admin/draft' | '/draft/room') {
    if (await action({ action: 'select', leagueId, draftId: draft.id })) window.location.assign(destination);
  }
  async function archive(draft: Draft) {
    if (!confirm(`Archive the completed ${draft.year} draft? It will remain historically accessible and will not be deleted.`)) return;
    if (await action({ action: 'archive', leagueId, draftId: draft.id })) setMessage(`${draft.year} draft archived.`);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.18em] text-amber-500">Platform Admin</p><h1 className="text-3xl font-black text-[var(--text)]">Draft Administration</h1><p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">Drafts are now scoped by LeagueZone league and year. Create future drafts before Sleeper creates the next league, rehearse them in isolation, and archive completed drafts instead of overwriting them.</p></div><Link href="/admin" className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">Admin Home</Link></div>
      {message && <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">{message}</div>}
      <div className="mb-6 grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-black text-[var(--text)]">League</h2><select value={leagueId} onChange={(e) => setLeagueId(e.target.value)} className="mt-3 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--text)]">{data.leagues.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{league && <div className="mt-3 flex gap-2 text-xs"><Link href={`/admin/qa?league=${encodeURIComponent(league.id)}`} className="rounded-lg border border-amber-500/30 px-2.5 py-1.5 text-amber-500">QA This League</Link><Link href={`/l/${league.slug}/draft`} className="rounded-lg border border-[var(--border)] px-2.5 py-1.5">League Draft Page</Link></div>}</section>
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-black text-[var(--text)]">Create Future / Live Draft</h2><div className="mt-3 grid grid-cols-3 gap-3"><label className="text-xs font-semibold text-[var(--muted)]">Year<input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-sm text-[var(--text)]"/></label><label className="text-xs font-semibold text-[var(--muted)]">Rounds<input type="number" min="1" max="20" value={rounds} onChange={(e) => setRounds(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-sm text-[var(--text)]"/></label><label className="text-xs font-semibold text-[var(--muted)]">Clock (sec)<input type="number" min="10" value={clockSeconds} onChange={(e) => setClockSeconds(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-sm text-[var(--text)]"/></label></div><button disabled={saving || !leagueId} onClick={create} className="mt-4 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-black text-white disabled:opacity-50">Create Draft</button></section>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><div className="flex items-center justify-between"><h2 className="font-black text-[var(--text)]">{league?.name || 'League'} Drafts</h2><span className="text-xs text-[var(--muted)]">{rehearsalCount} rehearsal session{rehearsalCount === 1 ? '' : 's'} stored separately</span></div>{loading ? <p className="mt-4 text-sm text-[var(--muted)]">Loading…</p> : <div className="mt-4 space-y-3">{liveDrafts.length === 0 ? <p className="text-sm text-[var(--muted)]">No LeagueZone-managed drafts yet.</p> : liveDrafts.map((draft) => <div key={draft.id} className={`rounded-xl border p-4 ${draft.archivedAt ? 'border-[var(--border)] opacity-70' : 'border-[var(--border)]'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className="text-lg font-black text-[var(--text)]">{draft.year} Draft</span><span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-[10px] font-black uppercase text-[var(--muted)]">{draft.archivedAt ? 'Archived' : draft.status}</span></div><p className="text-xs text-[var(--muted)]">{draft.rounds} rounds · {draft.clockSeconds}s clock · created {new Date(draft.createdAt).toLocaleDateString()}</p></div>{!draft.archivedAt && <div className="flex flex-wrap gap-2 text-xs font-semibold"><button onClick={() => openDraft(draft, '/draft/room')} className="rounded-lg bg-[var(--accent)] px-3 py-2 text-white">Open Draft Room</button><button onClick={() => openDraft(draft, '/admin/draft')} className="rounded-lg border border-[var(--border)] px-3 py-2">Setup / Commissioner Console</button><Link href={`/admin/qa?league=${encodeURIComponent(leagueId)}&year=${draft.year}&sourceDraft=${encodeURIComponent(draft.id)}`} className="rounded-lg border border-amber-500/30 px-3 py-2 text-amber-500">Rehearse</Link>{draft.status === 'COMPLETED' && <button onClick={() => archive(draft)} className="rounded-lg border border-[var(--border)] px-3 py-2">Archive</button>}</div>}</div></div>)}</div>}</section>
      <div className="mt-4 text-xs text-[var(--muted)]">Completed drafts are archived in place. Rehearsals use separate draft IDs and can be reset or deleted without touching live draft history.</div>
    </div>
  );
}
