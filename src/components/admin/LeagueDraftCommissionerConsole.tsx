'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type DraftPick = {
  overall: number;
  round: number;
  team: string;
  playerId: string;
  playerName?: string | null;
  playerPos?: string | null;
  playerNfl?: string | null;
};

type DraftOverview = {
  id: string;
  year: number;
  rounds: number;
  clockSeconds: number;
  status: 'NOT_STARTED' | 'LIVE' | 'PAUSED' | 'COMPLETED';
  curOverall: number;
  onClockTeam?: string | null;
  recentPicks: DraftPick[];
  allPicks?: DraftPick[];
  allSlots?: Array<{ overall: number; round: number; team: string }>;
};

type PendingPick = {
  id: string;
  overall: number;
  team: string;
  playerId: string;
  playerName: string | null;
  playerPos: string | null;
  playerNfl: string | null;
} | null;

type AvailablePlayer = { id: string; name: string; pos: string; nfl: string };

type PendingTrade = {
  id: string;
  proposedBy: string;
  teams: string[];
  assets: Array<{
    id: string;
    fromTeam: string;
    toTeam: string;
    assetType: string;
    playerName?: string | null;
    playerId?: string | null;
    pickOverall?: number | null;
    pickYear?: number | null;
    pickRound?: number | null;
  }>;
};

type Lifecycle = {
  state: 'scheduled' | 'open' | 'paused' | 'complete' | 'archived';
  date: string | null;
  location: string;
  canManage: boolean;
};

const LIFECYCLE_OPTIONS: Array<{ value: Lifecycle['state']; label: string }> = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'open', label: 'Open to league' },
  { value: 'paused', label: 'Paused' },
  { value: 'complete', label: 'Complete' },
  { value: 'archived', label: 'Archived' },
];

function formatClock(seconds: number | null) {
  if (seconds == null) return '--:--';
  const mins = Math.floor(Math.max(0, seconds) / 60);
  const secs = Math.max(0, seconds) % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export default function LeagueDraftCommissionerConsole({ leagueSlug }: { leagueSlug: string }) {
  const [draft, setDraft] = useState<DraftOverview | null>(null);
  const [pendingPick, setPendingPick] = useState<PendingPick>(null);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [pendingTrades, setPendingTrades] = useState<PendingTrade[]>([]);
  const [lifecycle, setLifecycle] = useState<Lifecycle>({ state: 'scheduled', date: null, location: '', canManage: true });
  const [lifecycleDraft, setLifecycleDraft] = useState<Lifecycle>({ state: 'scheduled', date: null, location: '', canManage: true });
  const [clockSeconds, setClockSeconds] = useState('60');
  const [search, setSearch] = useState('');
  const [available, setAvailable] = useState<AvailablePlayer[]>([]);
  const [forcePlayerId, setForcePlayerId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async (includeAvailable = false) => {
    try {
      const draftUrl = includeAvailable ? '/api/draft?include=available' : '/api/draft';
      const [draftRes, lifecycleRes, tradesRes] = await Promise.all([
        fetch(draftUrl, { cache: 'no-store' }),
        fetch('/api/draft/lifecycle', { cache: 'no-store' }),
        fetch('/api/draft/trade?action=get_admin_pending', { cache: 'no-store' }),
      ]);
      if (!draftRes.ok) throw new Error('Could not load the selected draft. Return to Draft Setup and select it again.');
      const draftJson = await draftRes.json();
      const nextDraft = (draftJson?.draft || null) as DraftOverview | null;
      setDraft(nextDraft);
      setPendingPick((draftJson?.pendingPick ?? null) as PendingPick);
      setRemainingSec(typeof draftJson?.remainingSec === 'number' ? draftJson.remainingSec : null);
      if (includeAvailable) setAvailable((draftJson?.available || []) as AvailablePlayer[]);
      if (nextDraft) setClockSeconds(String(nextDraft.clockSeconds || 60));

      if (lifecycleRes.ok) {
        const life = await lifecycleRes.json() as Lifecycle;
        const normalized = { ...life, date: life.date || null, location: life.location || '' };
        setLifecycle(normalized);
        setLifecycleDraft(normalized);
      }
      if (tradesRes.ok) {
        const tradesJson = await tradesRes.json();
        setPendingTrades((tradesJson?.trades || []) as PendingTrade[]);
      }
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load commissioner controls.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => { void load(false); }, 4000);
    return () => window.clearInterval(interval);
  }, [load]);

  const selectedForcePlayer = useMemo(
    () => available.find((player) => player.id === forcePlayerId) || null,
    [available, forcePlayerId],
  );

  async function postDraft(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...(draft?.id ? { id: draft.id } : {}), ...extra }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.error) throw new Error(body?.error || `Draft action failed (${response.status}).`);
      await load(true);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Draft action failed.');
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function saveLifecycle(next: Lifecycle, quiet = false) {
    const response = await fetch('/api/draft/lifecycle', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state: next.state, date: next.date || '', location: next.location || '' }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error || 'Could not update league draft availability.');
    const normalized = { ...(body as Lifecycle), date: body.date || null, location: body.location || '' };
    setLifecycle(normalized);
    setLifecycleDraft(normalized);
    if (!quiet) setMessage('League draft availability updated.');
  }

  async function startDraft() {
    setBusy('start');
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'start', id: draft?.id }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.error) throw new Error(body?.error || 'Could not start draft.');
      try {
        await saveLifecycle({ ...lifecycle, state: 'open' }, true);
      } catch (lifecycleError) {
        await fetch('/api/draft', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'pause', id: draft?.id }),
        }).catch(() => {});
        throw lifecycleError;
      }
      setMessage('Draft started and opened to league members.');
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start draft.');
    } finally {
      setBusy(null);
    }
  }

  async function pauseDraft() {
    setBusy('pause');
    setMessage('');
    setError('');
    try {
      if (!(await postDraft('pause'))) return;
      await saveLifecycle({ ...lifecycle, state: 'paused' }, true);
      setMessage('Draft and league access paused.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not pause draft.');
    } finally {
      setBusy(null);
    }
  }

  async function resumeDraft() {
    setBusy('resume');
    setMessage('');
    setError('');
    try {
      await saveLifecycle({ ...lifecycle, state: 'open' }, true);
      if (!(await postDraft('resume'))) {
        await saveLifecycle({ ...lifecycle, state: 'paused' }, true).catch(() => {});
        return;
      }
      setMessage('Draft resumed and open to league members.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resume draft.');
    } finally {
      setBusy(null);
    }
  }

  async function saveAvailability() {
    setBusy('lifecycle');
    setMessage('');
    setError('');
    try {
      await saveLifecycle(lifecycleDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update draft availability.');
    } finally {
      setBusy(null);
    }
  }

  async function decideTrade(tradeId: string, action: 'approve' | 'reject_admin') {
    setBusy(`${action}:${tradeId}`);
    setError('');
    try {
      const response = await fetch('/api/draft/trade', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, draftId: draft?.id, tradeId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'Trade decision failed.');
      setMessage(action === 'approve' ? 'Trade approved.' : 'Trade rejected.');
      await load(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trade decision failed.');
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-6xl px-4 py-8 text-sm text-[var(--muted)]">Loading commissioner draft controls…</main>;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--accent)]">Commissioner</p>
          <h1 className="mt-1 text-2xl font-black text-[var(--text)]">Live Draft Control</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Control the selected LeagueZone draft, member access, pending picks, clock, and draft-day trades.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/l/${encodeURIComponent(leagueSlug)}/admin`} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text)]">Draft Setup</Link>
          <Link href="/draft/room" className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-black text-white">Open Draft Room</Link>
          <Link href="/draft/overlay" target="_blank" className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text)]">Presentation View</Link>
        </div>
      </div>

      {error && <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-600 dark:text-red-300">{error}</div>}
      {message && <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-300">{message}</div>}

      {!draft ? (
        <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="font-black text-[var(--text)]">No draft selected</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Return to Draft Setup and choose a LeagueZone-managed draft first.</p>
        </div>
      ) : (
        <>
          <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><div className="text-[11px] font-black uppercase text-[var(--muted)]">Draft</div><div className="mt-1 text-lg font-black text-[var(--text)]">{draft.year} · {draft.status}</div></div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><div className="text-[11px] font-black uppercase text-[var(--muted)]">On clock</div><div className="mt-1 text-lg font-black text-[var(--text)]">{draft.onClockTeam || 'None'}</div></div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><div className="text-[11px] font-black uppercase text-[var(--muted)]">Current pick</div><div className="mt-1 text-lg font-black text-[var(--text)]">#{draft.curOverall}</div></div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><div className="text-[11px] font-black uppercase text-[var(--muted)]">Clock</div><div className="mt-1 text-lg font-black tabular-nums text-[var(--text)]">{formatClock(remainingSec)}</div></div>
          </section>

          <section className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
            <h2 className="font-black text-[var(--text)]">Draft Controls</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {draft.status === 'NOT_STARTED' && <button disabled={busy !== null} onClick={startDraft} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-black text-white disabled:opacity-50">Start Draft</button>}
              {draft.status === 'LIVE' && <button disabled={busy !== null} onClick={pauseDraft} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)] disabled:opacity-50">Pause Draft</button>}
              {draft.status === 'PAUSED' && !pendingPick && <button disabled={busy !== null} onClick={resumeDraft} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-black text-white disabled:opacity-50">Resume Draft</button>}
              {draft.status !== 'COMPLETED' && <button disabled={busy !== null} onClick={() => void postDraft('reset_clock')} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)] disabled:opacity-50">Reset Pick Clock</button>}
              {(draft.allPicks?.length || draft.recentPicks.length) > 0 && <button disabled={busy !== null} onClick={() => { if (confirm('Undo the last completed draft pick?')) void postDraft('undo'); }} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)] disabled:opacity-50">Undo Last Pick</button>}
              {draft.status !== 'COMPLETED' && <button disabled={busy !== null} onClick={() => { if (confirm(`Skip pick #${draft.curOverall}?`)) void postDraft('skip_pick'); }} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)] disabled:opacity-50">Skip Pick</button>}
              {draft.status !== 'COMPLETED' && <button disabled={busy !== null} onClick={() => void postDraft('auto_pick')} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)] disabled:opacity-50">Auto-pick Now</button>}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-[180px_auto] sm:items-end">
              <label className="text-xs font-semibold text-[var(--muted)]">Clock length (seconds)<input type="number" min="10" max="86400" value={clockSeconds} onChange={(event) => setClockSeconds(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text)]" /></label>
              <button disabled={busy !== null} onClick={() => void postDraft('set_clock', { seconds: Number(clockSeconds) })} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)] disabled:opacity-50">Save Clock Length</button>
            </div>
          </section>

          <section className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
            <h2 className="font-black text-[var(--text)]">League Draft Availability</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Starting or resuming from this console automatically opens the member-facing draft room. Pausing here pauses both the clock and league access.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr_1fr_auto] md:items-end">
              <label className="text-xs font-semibold text-[var(--muted)]">State<select value={lifecycleDraft.state} onChange={(event) => setLifecycleDraft((current) => ({ ...current, state: event.target.value as Lifecycle['state'] }))} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text)]">{LIFECYCLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label className="text-xs font-semibold text-[var(--muted)]">Date<input type="datetime-local" value={lifecycleDraft.date ? lifecycleDraft.date.slice(0, 16) : ''} onChange={(event) => setLifecycleDraft((current) => ({ ...current, date: event.target.value || null }))} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text)]" /></label>
              <label className="text-xs font-semibold text-[var(--muted)]">Location / video link<input value={lifecycleDraft.location} onChange={(event) => setLifecycleDraft((current) => ({ ...current, location: event.target.value }))} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text)]" /></label>
              <button disabled={busy !== null} onClick={saveAvailability} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)] disabled:opacity-50">Save Availability</button>
            </div>
          </section>

          {pendingPick && (
            <section className="mt-4 rounded-2xl border-2 border-amber-400/60 bg-amber-400/10 p-4 sm:p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-600 dark:text-amber-300">Pending Pick Approval</p>
              <div className="mt-2 text-xl font-black text-[var(--text)]">{pendingPick.playerName || pendingPick.playerId}</div>
              <div className="mt-1 text-sm text-[var(--muted)]">{pendingPick.team} · Pick #{pendingPick.overall} · {[pendingPick.playerPos, pendingPick.playerNfl].filter(Boolean).join(' · ')}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button disabled={busy !== null} onClick={() => void postDraft('approve_pick')} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">Approve Pick</button>
                <button disabled={busy !== null} onClick={() => void postDraft('reject_pick')} className="rounded-lg border border-red-500/50 px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-300 disabled:opacity-50">Reject Pick</button>
              </div>
            </section>
          )}

          {pendingTrades.length > 0 && (
            <section className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
              <h2 className="font-black text-[var(--text)]">Trades Awaiting Commissioner Approval</h2>
              <div className="mt-3 space-y-3">
                {pendingTrades.map((trade) => (
                  <div key={trade.id} className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
                    <div className="text-sm font-black text-[var(--text)]">{trade.teams.join(' ↔ ')}</div>
                    <div className="mt-2 space-y-1 text-xs text-[var(--muted)]">
                      {trade.assets.map((asset) => <div key={asset.id}>{asset.fromTeam} sends {asset.assetType === 'player' ? (asset.playerName || asset.playerId) : asset.assetType === 'current_pick' ? `Pick #${asset.pickOverall}` : `${asset.pickYear} Round ${asset.pickRound}`} → {asset.toTeam}</div>)}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button disabled={busy !== null} onClick={() => void decideTrade(trade.id, 'approve')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50">Approve Trade</button>
                      <button disabled={busy !== null} onClick={() => void decideTrade(trade.id, 'reject_admin')} className="rounded-lg border border-red-500/50 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-300 disabled:opacity-50">Reject Trade</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {draft.status !== 'COMPLETED' && (
            <section className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
              <h2 className="font-black text-[var(--text)]">Force a Pick</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">Use only when the commissioner needs to enter a selection directly. The player must be in the current eligible pool for this draft.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <label className="text-xs font-semibold text-[var(--muted)]">Search<input value={search} onChange={async (event) => { const q = event.target.value; setSearch(q); if (q.trim().length < 2) return; const response = await fetch('/api/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'available', q, limit: 25 }) }); const body = await response.json().catch(() => ({})); if (response.ok) setAvailable((body?.available || []) as AvailablePlayer[]); }} placeholder="Player or defense" className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text)]" /></label>
                <label className="text-xs font-semibold text-[var(--muted)]">Selection<select value={forcePlayerId} onChange={(event) => setForcePlayerId(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text)]"><option value="">Choose…</option>{available.map((player) => <option key={player.id} value={player.id}>{player.name} · {player.pos} · {player.nfl}</option>)}</select></label>
                <button disabled={busy !== null || !selectedForcePlayer} onClick={() => selectedForcePlayer && void postDraft('force_pick', { playerId: selectedForcePlayer.id, playerName: selectedForcePlayer.name, playerPos: selectedForcePlayer.pos, playerNfl: selectedForcePlayer.nfl })} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)] disabled:opacity-50">Force Pick</button>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
