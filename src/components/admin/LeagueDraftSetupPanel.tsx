'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  DRAFT_PLAYER_POOL_OPTIONS,
  normalizeDraftPlayerPoolType,
  type DraftPlayerPoolType,
} from '@/lib/draft/player-pool';
import {
  DRAFT_ORDER_OPTIONS,
  normalizeDraftOrderType,
  type DraftOrderType,
} from '@/lib/draft/draft-order';
import {
  parseCustomDraftPlayerPool,
  validateCustomDraftPlayers,
  type CustomDraftPlayer,
} from '@/lib/draft/custom-player-pool';

type LeagueTeam = { rosterId: number; teamName: string; ownerName: string | null };
type DraftRow = {
  id: string;
  year: number;
  rounds: number;
  clockSeconds: number;
  status: string;
  archivedAt: string | null;
  createdAt: string;
  completedAt: string | null;
  draftOrderType: DraftOrderType;
  playerPool: {
    type: DraftPlayerPoolType;
    syncedAt: string | null;
    draftableCount: number;
    usesLiveSleeperPool: boolean;
  };
};

type DraftPayload = {
  league: { id: string; slug: string; name: string };
  teams: LeagueTeam[];
  drafts: DraftRow[];
};

function poolLabel(type: DraftPlayerPoolType) {
  return DRAFT_PLAYER_POOL_OPTIONS.find((option) => option.value === type)?.label || 'All players';
}

function orderLabel(type: DraftOrderType) {
  return DRAFT_ORDER_OPTIONS.find((option) => option.value === type)?.label || 'Linear';
}

function moveTeam(order: string[], index: number, delta: -1 | 1): string[] {
  const target = index + delta;
  if (target < 0 || target >= order.length) return order;
  const next = [...order];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export default function LeagueDraftSetupPanel({ leagueSlug }: { leagueSlug: string }) {
  const [data, setData] = useState<DraftPayload | null>(null);
  const [year, setYear] = useState(String(new Date().getFullYear() + 1));
  const [rounds, setRounds] = useState('4');
  const [clockSeconds, setClockSeconds] = useState('60');
  const [playerPoolType, setPlayerPoolType] = useState<DraftPlayerPoolType>('all_players');
  const [draftOrderType, setDraftOrderType] = useState<DraftOrderType>('linear');
  const [roundOrders, setRoundOrders] = useState<Record<number, string[]>>({});
  const [customPlayers, setCustomPlayers] = useState<CustomDraftPlayer[]>([]);
  const [customFileName, setCustomFileName] = useState('');
  const [draftPoolEdits, setDraftPoolEdits] = useState<Record<string, DraftPlayerPoolType>>({});
  const [replacementPools, setReplacementPools] = useState<Record<string, CustomDraftPlayer[]>>({});
  const [replacementNames, setReplacementNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/league-admin/drafts?league=${encodeURIComponent(leagueSlug)}`, { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      const payload = body as DraftPayload;
      setData(payload);
      const next: Record<string, DraftPlayerPoolType> = {};
      for (const draft of payload.drafts || []) next[draft.id] = normalizeDraftPlayerPoolType(draft.playerPool?.type);
      setDraftPoolEdits(next);
    } else {
      setMessage(body.error || 'Could not load draft setup.');
    }
    setLoading(false);
  }, [leagueSlug]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const teamNames = (data?.teams || []).map((team) => team.teamName);
    const roundCount = Math.max(1, Math.min(40, Number(rounds) || 1));
    if (teamNames.length === 0) return;
    setRoundOrders((current) => {
      const next: Record<number, string[]> = {};
      for (let round = 1; round <= roundCount; round += 1) {
        const existing = current[round];
        next[round] = existing && existing.length === teamNames.length && existing.every((team) => teamNames.includes(team))
          ? existing
          : [...teamNames];
      }
      return next;
    });
  }, [data?.teams, rounds]);

  const activeDrafts = useMemo(() => (data?.drafts || []).filter((draft) => !draft.archivedAt), [data?.drafts]);
  const customPoolError = playerPoolType === 'custom' ? validateCustomDraftPlayers(customPlayers) : null;

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

  async function readCustomFile(file: File, targetDraftId?: string) {
    const players = parseCustomDraftPlayerPool(await file.text());
    const error = validateCustomDraftPlayers(players);
    if (error) {
      setMessage(error);
      return;
    }
    if (targetDraftId) {
      setReplacementPools((current) => ({ ...current, [targetDraftId]: players }));
      setReplacementNames((current) => ({ ...current, [targetDraftId]: file.name }));
    } else {
      setCustomPlayers(players);
      setCustomFileName(file.name);
    }
    setMessage(`${players.length} custom draftable players loaded from ${file.name}.`);
  }

  async function createDraft() {
    const result = await action({
      action: 'create',
      year: Number(year),
      rounds: Number(rounds),
      clockSeconds: Number(clockSeconds),
      playerPoolType,
      draftOrderType,
      roundOrders: draftOrderType === 'custom' ? roundOrders : undefined,
      customPlayers: playerPoolType === 'custom' ? customPlayers : undefined,
    });
    if (result && !result.warning) setMessage(`${year} draft created and ready for setup.`);
  }

  async function openDraft(draft: DraftRow, destination: '/draft/room' | '/admin/draft' = '/draft/room') {
    const result = await action({ action: 'select', draftId: draft.id });
    if (result) window.location.assign(destination);
  }

  async function refreshPool(draft: DraftRow) {
    const type = draftPoolEdits[draft.id] || draft.playerPool.type;
    if (type === 'custom') {
      const players = replacementPools[draft.id] || [];
      const error = validateCustomDraftPlayers(players);
      if (error) { setMessage(error); return; }
      const result = await action({ action: 'replace_custom_pool', draftId: draft.id, customPlayers: players });
      if (result) setMessage(`${draft.year} custom pool imported: ${result.pool?.count ?? players.length} draftable entries.`);
      return;
    }
    const result = await action({ action: 'sync_player_pool', draftId: draft.id, playerPoolType: type });
    if (result && !result.warning) setMessage(`${draft.year} player pool refreshed: ${result.pool?.count ?? 0} draftable entries.`);
  }

  return (
    <section className="mx-auto mt-8 max-w-7xl px-3 pb-8 sm:px-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--accent)]">Commissioner</p>
            <h2 className="mt-1 text-xl font-black text-[var(--text)]">Draft Setup</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Configure future drafts independently of Sleeper league creation. Player eligibility, draft order, and imported pools are saved with the draft and lock when the draft starts.
            </p>
          </div>
          <Link href={`/l/${encodeURIComponent(leagueSlug)}/draft`} className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-center text-sm font-semibold text-[var(--text)] sm:w-auto">
            League Draft Page
          </Link>
        </div>

        {message && <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--text)]">{message}</div>}

        <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 sm:p-4">
          <h3 className="font-black text-[var(--text)]">Create Draft</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label className="text-xs font-semibold text-[var(--muted)]">Draft year<input type="number" value={year} onChange={(event) => setYear(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)]" /></label>
            <label className="text-xs font-semibold text-[var(--muted)]">Rounds<input type="number" min="1" max="40" value={rounds} onChange={(event) => setRounds(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)]" /></label>
            <label className="text-xs font-semibold text-[var(--muted)]">Pick clock (seconds)<input type="number" min="10" max="86400" value={clockSeconds} onChange={(event) => setClockSeconds(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)]" /></label>
            <label className="text-xs font-semibold text-[var(--muted)]">Draftable players<select value={playerPoolType} onChange={(event) => setPlayerPoolType(normalizeDraftPlayerPoolType(event.target.value))} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)]">{DRAFT_PLAYER_POOL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="text-xs font-semibold text-[var(--muted)]">Draft order<select value={draftOrderType} onChange={(event) => setDraftOrderType(normalizeDraftOrderType(event.target.value))} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)]">{DRAFT_ORDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          </div>
          <div className="mt-2 grid gap-1 text-xs leading-5 text-[var(--muted)] sm:grid-cols-2">
            <p>{DRAFT_PLAYER_POOL_OPTIONS.find((option) => option.value === playerPoolType)?.description}</p>
            <p>{DRAFT_ORDER_OPTIONS.find((option) => option.value === draftOrderType)?.description}</p>
          </div>

          {playerPoolType === 'custom' && (
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
              <label className="block text-xs font-semibold text-[var(--muted)]">Custom player pool CSV or JSON
                <input type="file" accept=".csv,.json,text/csv,application/json" className="mt-2 block w-full text-sm text-[var(--text)]" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readCustomFile(file); }} />
              </label>
              <p className="mt-2 text-xs text-[var(--muted)]">CSV: id,name,pos,nfl,rank. JSON: an array with the same fields. `id` may be a Sleeper player ID so LeagueZone can retain automatic headshots.</p>
              <p className="mt-2 text-xs font-semibold text-[var(--text)]">{customFileName ? `${customFileName}: ${customPlayers.length} players` : 'No custom pool loaded.'}</p>
            </div>
          )}

          {draftOrderType === 'custom' && data?.teams?.length ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-[var(--muted)]">Set each round independently. Use this for traded rookie picks or any non-standard order.</p>
              {Array.from({ length: Math.max(1, Math.min(40, Number(rounds) || 1)) }, (_, index) => index + 1).map((round) => (
                <details key={round} className="rounded-xl border border-[var(--border)] bg-[var(--surface)]" open={round === 1}>
                  <summary className="cursor-pointer px-3 py-2.5 text-sm font-black text-[var(--text)]">Round {round}</summary>
                  <div className="border-t border-[var(--border)] p-2 sm:p-3">
                    {(roundOrders[round] || []).map((team, index) => (
                      <div key={`${round}-${team}`} className="flex min-w-0 items-center gap-2 border-b border-[var(--border)]/60 py-2 last:border-0">
                        <span className="w-8 shrink-0 text-center text-xs font-black text-[var(--muted)]">{index + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text)]">{team}</span>
                        <button type="button" aria-label={`Move ${team} up in round ${round}`} disabled={index === 0} onClick={() => setRoundOrders((current) => ({ ...current, [round]: moveTeam(current[round] || [], index, -1) }))} className="min-h-10 min-w-10 rounded-lg border border-[var(--border)] px-2 disabled:opacity-30">↑</button>
                        <button type="button" aria-label={`Move ${team} down in round ${round}`} disabled={index === (roundOrders[round]?.length || 0) - 1} onClick={() => setRoundOrders((current) => ({ ...current, [round]: moveTeam(current[round] || [], index, 1) }))} className="min-h-10 min-w-10 rounded-lg border border-[var(--border)] px-2 disabled:opacity-30">↓</button>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          ) : null}

          <button type="button" disabled={saving || !year || !rounds || !clockSeconds || Boolean(customPoolError)} onClick={createDraft} className="mt-4 w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-black text-white disabled:opacity-50 sm:w-auto">{saving ? 'Saving…' : 'Create Draft'}</button>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-3"><h3 className="font-black text-[var(--text)]">League Drafts</h3><span className="text-xs text-[var(--muted)]">{activeDrafts.length} active setup{activeDrafts.length === 1 ? '' : 's'}</span></div>
          {loading ? <p className="mt-3 text-sm text-[var(--muted)]">Loading draft setup…</p> : activeDrafts.length === 0 ? <p className="mt-3 text-sm text-[var(--muted)]">No LeagueZone-managed drafts have been created for this league.</p> : (
            <div className="mt-3 space-y-3">
              {activeDrafts.map((draft) => {
                const poolType = draftPoolEdits[draft.id] || draft.playerPool.type;
                const poolSummary = `${draft.playerPool.draftableCount} saved draftable entries`;
                return (
                  <div key={draft.id} className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 sm:p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-lg font-black text-[var(--text)]">{draft.year} Draft</span><span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-black uppercase text-[var(--muted)]">{draft.status}</span></div><p className="mt-1 text-xs text-[var(--muted)]">{draft.rounds} rounds · {draft.clockSeconds}s clock · {poolLabel(draft.playerPool.type)} · {orderLabel(draft.draftOrderType)}</p><p className="mt-1 text-xs text-[var(--muted)]">{poolSummary}{draft.playerPool.syncedAt ? ` · updated ${new Date(draft.playerPool.syncedAt).toLocaleString()}` : ''}</p></div>
                      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap"><button type="button" disabled={saving} onClick={() => openDraft(draft)} className="rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-black text-white disabled:opacity-50">Open Draft Room</button><button type="button" disabled={saving} onClick={() => openDraft(draft, '/admin/draft')} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text)] disabled:opacity-50">Commissioner Console</button>{draft.status === 'COMPLETED' && <button type="button" disabled={saving} onClick={() => void action({ action: 'archive', draftId: draft.id })} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text)] disabled:opacity-50">Archive</button>}</div>
                    </div>
                    {draft.status === 'NOT_STARTED' && (
                      <div className="mt-4 border-t border-[var(--border)] pt-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end"><label className="min-w-0 flex-1 text-xs font-semibold text-[var(--muted)]">Player pool<select value={poolType} onChange={(event) => setDraftPoolEdits((current) => ({ ...current, [draft.id]: normalizeDraftPlayerPoolType(event.target.value) }))} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]">{DRAFT_PLAYER_POOL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>{poolType !== 'custom' && <button type="button" disabled={saving} onClick={() => refreshPool(draft)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text)] disabled:opacity-50">Refresh from Sleeper</button>}</div>
                        {poolType === 'custom' && <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"><input type="file" accept=".csv,.json,text/csv,application/json" className="block w-full text-sm text-[var(--text)]" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readCustomFile(file, draft.id); }} /><div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><span className="text-xs text-[var(--muted)]">{replacementNames[draft.id] ? `${replacementNames[draft.id]}: ${replacementPools[draft.id]?.length || 0} players` : 'Choose a CSV or JSON file.'}</span><button type="button" disabled={saving || !(replacementPools[draft.id]?.length)} onClick={() => refreshPool(draft)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text)] disabled:opacity-50">Import Custom Pool</button></div></div>}
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
