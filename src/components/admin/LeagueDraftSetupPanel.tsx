'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  DRAFT_PLAYER_POOL_OPTIONS,
  normalizeDraftPlayerPoolType,
  type DraftPlayerPoolType,
} from '@/lib/draft/player-pool';

type DraftRow = {
  id: string;
  year: number;
  rounds: number;
  clockSeconds: number;
  status: string;
  archivedAt: string | null;
  createdAt: string;
  completedAt: string | null;
  playerPool: {
    type: DraftPlayerPoolType;
    syncedAt: string | null;
    draftableCount: number;
    usesLiveSleeperPool: boolean;
  };
};

type DraftPayload = {
  league: { id: string; slug: string; name: string };
  drafts: DraftRow[];
};

function poolLabel(type: DraftPlayerPoolType) {
  return DRAFT_PLAYER_POOL_OPTIONS.find((option) => option.value === type)?.label || 'All players';
}

export default function LeagueDraftSetupPanel({ leagueSlug }: { leagueSlug: string }) {
  const [data, setData] = useState<DraftPayload | null>(null);
  const [year, setYear] = useState(String(new Date().getFullYear() + 1));
  const [rounds, setRounds] = useState('4');
  const [clockSeconds, setClockSeconds] = useState('60');
  const [playerPoolType, setPlayerPoolType] = useState<DraftPlayerPoolType>('all_players');
  const [draftPoolEdits, setDraftPoolEdits] = useState<Record<string, DraftPlayerPoolType>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/league-admin/drafts?league=${encodeURIComponent(leagueSlug)}`, { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setData(body as DraftPayload);
      const next: Record<string, DraftPlayerPoolType> = {};
      for (const draft of (body as DraftPayload).drafts || []) next[draft.id] = normalizeDraftPlayerPoolType(draft.playerPool?.type);
      setDraftPoolEdits(next);
    } else {
      setMessage(body.error || 'Could not load draft setup.');
    }
    setLoading(false);
  }, [leagueSlug]);

  useEffect(() => { void load(); }, [load]);

  const activeDrafts = useMemo(() => (data?.drafts || []).filter((draft) => !draft.archivedAt), [data?.drafts]);

  async function action(body: Record<string, unknown>) {
    setSaving(true);
    setMessage('');
    const res = await fetch('/api/league-admin/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ league: leagueSlug, ...body }),
    });
    const result = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMessage(result.error || 'Draft action failed.');
      return null;
    }
    if (result.warning) setMessage(result.warning);
    await load();
    return result;
  }

  async function createDraft() {
    const result = await action({
      action: 'create',
      year: Number(year),
      rounds: Number(rounds),
      clockSeconds: Number(clockSeconds),
      playerPoolType,
    });
    if (result && !result.warning) setMessage(`${year} draft created and ready for setup.`);
  }

  async function openDraft(draft: DraftRow) {
    const result = await action({ action: 'select', draftId: draft.id });
    if (result) window.location.assign('/draft/room');
  }

  async function refreshPool(draft: DraftRow) {
    const type = draftPoolEdits[draft.id] || draft.playerPool.type;
    const result = await action({ action: 'sync_player_pool', draftId: draft.id, playerPoolType: type });
    if (result && !result.warning) {
      const countText = result.pool?.usesLiveSleeperPool ? 'live Sleeper catalog' : `${result.pool?.count ?? 0} draftable entries`;
      setMessage(`${draft.year} player pool refreshed: ${countText}.`);
    }
  }

  return (
    <section className="mx-auto mt-8 max-w-7xl px-4 pb-8">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--accent)]">Commissioner</p>
            <h2 className="mt-1 text-xl font-black text-[var(--text)]">Draft Setup</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Create a LeagueZone-managed draft before Sleeper creates the next league. Player eligibility is saved with the draft, and Sleeper-backed pools can be refreshed until the draft starts.
            </p>
          </div>
          <Link href={`/l/${encodeURIComponent(leagueSlug)}/draft`} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text)]">
            League Draft Page
          </Link>
        </div>

        {message && <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--text)]">{message}</div>}

        <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
          <h3 className="font-black text-[var(--text)]">Create Draft</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs font-semibold text-[var(--muted)]">
              Draft year
              <input type="number" value={year} onChange={(event) => setYear(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)]" />
            </label>
            <label className="text-xs font-semibold text-[var(--muted)]">
              Rounds
              <input type="number" min="1" max="40" value={rounds} onChange={(event) => setRounds(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)]" />
            </label>
            <label className="text-xs font-semibold text-[var(--muted)]">
              Pick clock (seconds)
              <input type="number" min="10" max="86400" value={clockSeconds} onChange={(event) => setClockSeconds(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)]" />
            </label>
            <label className="text-xs font-semibold text-[var(--muted)]">
              Draftable players
              <select value={playerPoolType} onChange={(event) => setPlayerPoolType(normalizeDraftPlayerPoolType(event.target.value))} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)]">
                {DRAFT_PLAYER_POOL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
            {DRAFT_PLAYER_POOL_OPTIONS.find((option) => option.value === playerPoolType)?.description}
          </p>
          <button type="button" disabled={saving || !year || !rounds || !clockSeconds} onClick={createDraft} className="mt-4 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">
            {saving ? 'Saving…' : 'Create Draft'}
          </button>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-black text-[var(--text)]">League Drafts</h3>
            <span className="text-xs text-[var(--muted)]">{activeDrafts.length} active setup{activeDrafts.length === 1 ? '' : 's'}</span>
          </div>

          {loading ? (
            <p className="mt-3 text-sm text-[var(--muted)]">Loading draft setup…</p>
          ) : activeDrafts.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">No LeagueZone-managed drafts have been created for this league.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {activeDrafts.map((draft) => {
                const poolType = draftPoolEdits[draft.id] || draft.playerPool.type;
                const poolSummary = draft.playerPool.usesLiveSleeperPool
                  ? 'Live Sleeper player catalog'
                  : `${draft.playerPool.draftableCount} synced draftable entries`;
                return (
                  <div key={draft.id} className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg font-black text-[var(--text)]">{draft.year} Draft</span>
                          <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-black uppercase text-[var(--muted)]">{draft.status}</span>
                        </div>
                        <p className="mt-1 text-xs text-[var(--muted)]">{draft.rounds} rounds · {draft.clockSeconds}s clock · {poolLabel(draft.playerPool.type)}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{poolSummary}{draft.playerPool.syncedAt ? ` · synced ${new Date(draft.playerPool.syncedAt).toLocaleString()}` : ''}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button type="button" disabled={saving} onClick={() => openDraft(draft)} className="rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-black text-white disabled:opacity-50">Open Draft Room</button>
                        {draft.status === 'COMPLETED' && (
                          <button type="button" disabled={saving} onClick={() => void action({ action: 'archive', draftId: draft.id })} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text)] disabled:opacity-50">Archive</button>
                        )}
                      </div>
                    </div>

                    {draft.status === 'NOT_STARTED' && (
                      <div className="mt-4 flex flex-col gap-2 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-end">
                        <label className="min-w-0 flex-1 text-xs font-semibold text-[var(--muted)]">
                          Player pool
                          <select value={poolType} onChange={(event) => setDraftPoolEdits((current) => ({ ...current, [draft.id]: normalizeDraftPlayerPoolType(event.target.value) }))} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]">
                            {DRAFT_PLAYER_POOL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </label>
                        <button type="button" disabled={saving} onClick={() => refreshPool(draft)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text)] disabled:opacity-50">Refresh from Sleeper</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
