'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import CountdownTimer from '@/components/ui/countdown-timer';
import SectionHeader from '@/components/ui/SectionHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Label from '@/components/ui/Label';
import Select from '@/components/ui/Select';
import EmptyState from '@/components/ui/empty-state';
import LoadingState from '@/components/ui/loading-state';
import ErrorState from '@/components/ui/error-state';
import { TeamLogo } from '@/components/ui/TeamLogo';
import PlayerLink from '@/components/players/PlayerLink';
import TeamProspectDraftboard from '@/components/draft/TeamProspectDraftboard';
import DraftContent from './DraftContent';

const COUNTDOWN_THRESHOLD_MS = 24 * 60 * 60 * 1000;

type DraftSlot = { overall: number; round: number; team: string };
type DraftSummaryPayload = {
  league: { id: string; slug: string; name: string } | null;
  lifecycle: { state: string; date: string | null; location: string } | null;
  draft: {
    id: string;
    year: number;
    rounds: number;
    clockSeconds: number;
    status: string;
    eventName: string | null;
    playerPoolType: string | null;
    playerPoolLabel: string;
    draftOrderType: string;
    draftOrderLabel: string;
    slots: DraftSlot[];
  } | null;
};

type Suggestion = { id: string; teamName: string; date: string; notes?: string; approvedAt?: string };
type HistoryPick = { pick_no: number; round: number; pick: number; team: string; player: string; playerId?: string; pos?: string };
type HistoryData = {
  rounds: number;
  picks_per_round: number;
  team_hauls: Array<{ team: string; picks: Array<{ round: number; pick: number; player: string; playerId?: string }> }>;
  linear_picks: HistoryPick[];
};
type HistoryPayload = { years: string[]; drafts: Record<string, HistoryData> };

function DraftHubNav({ active }: { active: 'next' | 'past' | 'team-prospect-draftboard' }) {
  const items = [
    { id: 'next' as const, label: 'Next Draft', href: '?view=next' },
    { id: 'past' as const, label: 'Previous Drafts', href: '?view=past' },
    { id: 'team-prospect-draftboard' as const, label: 'Team Prospect Draftboard', href: '?view=team-prospect-draftboard' },
  ];
  return (
    <div className="mt-6 flex gap-1 overflow-x-auto border-b border-[var(--border)]" aria-label="Draft sections">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            active === item.id
              ? 'border-[var(--accent)] text-[var(--text)]'
              : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

function statusLabel(status: string | undefined) {
  if (status === 'NOT_STARTED') return 'Not started';
  if (status === 'LIVE') return 'Live';
  if (status === 'PAUSED') return 'Paused';
  if (status === 'COMPLETED') return 'Completed';
  return status || 'Not configured';
}

function DraftOrderCard({ slots }: { slots: DraftSlot[] }) {
  const rounds = useMemo(() => {
    const grouped = new Map<number, DraftSlot[]>();
    for (const slot of slots.slice().sort((a, b) => a.overall - b.overall)) {
      const list = grouped.get(slot.round) || [];
      list.push(slot);
      grouped.set(slot.round, list);
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => a - b);
  }, [slots]);

  if (rounds.length === 0) return null;
  return (
    <Card>
      <CardHeader><CardTitle>Draft Order</CardTitle></CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-[var(--muted)]">This is the saved LeagueZone order for the active draft, including snake or custom round assignments.</p>
        <div className="space-y-3">
          {rounds.map(([round, picks]) => (
            <details key={round} open={round === 1} className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]/40">
              <summary className="cursor-pointer px-3 py-2.5 text-sm font-bold text-[var(--text)]">Round {round}</summary>
              <ol className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
                {picks.map((slot, index) => (
                  <li key={slot.overall} className="flex min-w-0 items-center gap-3 px-3 py-2.5">
                    <span className="w-10 shrink-0 text-xs font-black tabular-nums text-[var(--muted)]">{round}.{String(index + 1).padStart(2, '0')}</span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-black/10">
                      <TeamLogo teamName={slot.team} size={24} className="object-contain" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text)]">{slot.team}</span>
                    <span className="shrink-0 text-xs text-[var(--muted)]">#{slot.overall}</span>
                  </li>
                ))}
              </ol>
            </details>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DraftSuggestions({ isLoggedIn, isAdmin, onApproved }: { isLoggedIn: boolean; isAdmin: boolean; onApproved: () => void }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/draft/suggest', { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(body.suggestions)) setSuggestions(body.suggestions);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!date) { setMessage('Choose a date and time first.'); return; }
    setBusy(true); setMessage('');
    const res = await fetch('/api/draft/suggest', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ date, notes }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMessage(body.error || 'Could not submit suggestion.'); return; }
    setDate(''); setNotes(''); setMessage('Suggestion submitted.');
    if (Array.isArray(body.suggestions)) setSuggestions(body.suggestions); else await load();
  }

  async function approve(suggestion: Suggestion) {
    setBusy(true); setMessage('');
    const res = await fetch('/api/draft/suggest/approve', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: suggestion.id, date: suggestion.date }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMessage(body.error || 'Could not approve suggestion.'); return; }
    if (Array.isArray(body.suggestions)) setSuggestions(body.suggestions); else await load();
    onApproved();
  }

  return (
    <Card>
      <CardHeader><CardTitle>Draft Date Suggestions</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {suggestions.length > 0 && (
          <ul className="space-y-2">
            {suggestions.map((suggestion) => (
              <li key={suggestion.id} className="flex flex-col gap-2 rounded-lg border border-[var(--border)] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-sm">
                  <div className="font-semibold text-[var(--text)]">{new Date(suggestion.date).toLocaleString()}</div>
                  <div className="text-xs text-[var(--muted)]">Suggested by {suggestion.teamName}{suggestion.notes ? ` · ${suggestion.notes}` : ''}</div>
                  {suggestion.approvedAt && <div className="mt-1 text-xs font-semibold text-emerald-500">Approved</div>}
                </div>
                {isAdmin && !suggestion.approvedAt && <Button size="sm" disabled={busy} onClick={() => void approve(suggestion)}>Approve</Button>}
              </li>
            ))}
          </ul>
        )}
        {isLoggedIn ? (
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="text-sm font-semibold text-[var(--text)]">Date and time
              <input type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]" />
            </label>
            <label className="text-sm font-semibold text-[var(--text)]">Notes
              <input value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={200} placeholder="Optional" className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]" />
            </label>
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Suggest'}</Button>
          </form>
        ) : <p className="text-sm text-[var(--muted)]">Sign in to suggest a draft date.</p>}
        {message && <p className="text-sm text-[var(--muted)]">{message}</p>}
      </CardContent>
    </Card>
  );
}

function UpcomingDraftView() {
  const [summary, setSummary] = useState<DraftSummaryPayload | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const [summaryRes, meRes] = await Promise.all([
      fetch('/api/draft/summary', { cache: 'no-store' }),
      fetch('/api/auth/me', { cache: 'no-store' }),
    ]);
    const summaryBody = await summaryRes.json().catch(() => ({}));
    const meBody = await meRes.json().catch(() => ({}));
    if (!summaryRes.ok) setError(summaryBody.error || 'Could not load draft setup.');
    else setSummary(summaryBody as DraftSummaryPayload);
    setIsLoggedIn(Boolean(meBody.authenticated));
    setIsAdmin(Boolean(meBody.isAdmin));
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const draft = summary?.draft || null;
  const lifecycle = summary?.lifecycle || null;
  const league = summary?.league || null;
  const draftDate = lifecycle?.date ? new Date(lifecycle.date) : null;
  const validDate = draftDate && Number.isFinite(draftDate.getTime()) ? draftDate : null;
  const showCountdown = validDate ? validDate.getTime() - Date.now() > COUNTDOWN_THRESHOLD_MS : false;
  const displayName = draft?.eventName?.trim() || (draft ? `${draft.year} Draft` : 'Upcoming Draft');
  const roomOpen = Boolean(draft && lifecycle?.state === 'open');

  function addToCalendar() {
    if (!validDate) return;
    const end = new Date(validDate.getTime() + 2 * 60 * 60 * 1000);
    const format = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LeagueZone//Draft//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT', `UID:draft-${draft?.id || validDate.getTime()}@leaguezone`, `DTSTAMP:${format(new Date())}`,
      `DTSTART:${format(validDate)}`, `DTEND:${format(end)}`, `SUMMARY:${displayName.replace(/[\r\n]/g, ' ')}`,
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `draft-${draft?.year || validDate.getFullYear()}.ics`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  }

  if (loading) return <LoadingState message="Loading draft setup…" />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-5">
      {showCountdown && validDate && <CountdownTimer targetDate={validDate} title={`Countdown to ${displayName}`} />}

      <Card>
        <CardHeader><CardTitle>{displayName}</CardTitle></CardHeader>
        <CardContent>
          {draft ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-lg border border-[var(--border)] p-3"><div className="text-xs text-[var(--muted)]">Status</div><div className="mt-1 font-black text-[var(--text)]">{statusLabel(draft.status)}</div></div>
                <div className="rounded-lg border border-[var(--border)] p-3"><div className="text-xs text-[var(--muted)]">Rounds</div><div className="mt-1 font-black text-[var(--text)]">{draft.rounds}</div></div>
                <div className="rounded-lg border border-[var(--border)] p-3"><div className="text-xs text-[var(--muted)]">Pick clock</div><div className="mt-1 font-black text-[var(--text)]">{draft.clockSeconds}s</div></div>
                <div className="rounded-lg border border-[var(--border)] p-3"><div className="text-xs text-[var(--muted)]">Player pool</div><div className="mt-1 font-black text-[var(--text)]">{draft.playerPoolLabel}</div></div>
                <div className="rounded-lg border border-[var(--border)] p-3"><div className="text-xs text-[var(--muted)]">Order</div><div className="mt-1 font-black text-[var(--text)]">{draft.draftOrderLabel}</div></div>
              </div>
              <div className="flex flex-col gap-2 text-sm text-[var(--muted)] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div>{validDate ? `Scheduled ${validDate.toLocaleString()}` : 'Draft date has not been confirmed.'}{lifecycle?.location ? ` · ${lifecycle.location}` : ''}</div>
                <div className="flex flex-wrap gap-2">
                  {validDate && <Button variant="secondary" onClick={addToCalendar}>Add to Calendar</Button>}
                  {roomOpen && isLoggedIn && <Link href="/draft/room" className="btn btn-primary inline-flex items-center justify-center px-3 py-2 text-sm">Enter Draft Room</Link>}
                  {isAdmin && league && <Link href={`/l/${encodeURIComponent(league.slug)}/admin/draft`} className="btn inline-flex items-center justify-center border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]">Commissioner Console</Link>}
                </div>
              </div>
              {!roomOpen && draft.status !== 'COMPLETED' && <p className="text-xs text-[var(--muted)]">The commissioner has not opened member draft access yet.</p>}
              {draft.status === 'COMPLETED' && <p className="text-sm text-[var(--muted)]">This draft is complete. Its results remain available under Previous Drafts after archiving.</p>}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[var(--muted)]">No LeagueZone-managed draft has been configured for this league yet.</p>
              {isAdmin && league && <Link href={`/l/${encodeURIComponent(league.slug)}/admin`} className="btn btn-primary inline-flex items-center justify-center px-3 py-2 text-sm">Configure Draft</Link>}
            </div>
          )}
        </CardContent>
      </Card>

      {draft && <DraftOrderCard slots={draft.slots} />}
      {draft?.status !== 'LIVE' && draft?.status !== 'PAUSED' && draft?.status !== 'COMPLETED' && <DraftSuggestions isLoggedIn={isLoggedIn} isAdmin={isAdmin} onApproved={() => void load()} />}
      {!draft && <DraftSuggestions isLoggedIn={isLoggedIn} isAdmin={isAdmin} onApproved={() => void load()} />}
    </div>
  );
}

function ManagedHistoryView() {
  const [payload, setPayload] = useState<HistoryPayload | null>(null);
  const [selectedYear, setSelectedYear] = useState('');
  const [view, setView] = useState<'teams' | 'linear' | 'board'>('teams');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/draft/history', { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) setError(body.error || 'Could not load LeagueZone draft history.');
      else {
        const next = body as HistoryPayload;
        setPayload(next);
        setSelectedYear(next.years?.[0] || '');
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <LoadingState message="Loading completed drafts…" />;
  if (error) return <ErrorState message={error} />;
  const data = selectedYear && payload ? payload.drafts[selectedYear] : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Label htmlFor="leaguezone-draft-history-year">LeagueZone draft year</Label>
          <Select id="leaguezone-draft-history-year" value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)} className="mt-1 min-w-44">
            {(payload?.years || []).map((year) => <option key={year} value={year}>{year} Draft</option>)}
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="?view=past&source=provider" className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text)]">Imported Sleeper History</Link>
          {data && <div className="inline-flex overflow-hidden rounded-lg border border-[var(--border)]">
            {(['teams', 'linear', 'board'] as const).map((option) => <button key={option} type="button" onClick={() => setView(option)} className={`px-3 py-2 text-xs font-bold ${view === option ? 'bg-[var(--accent)] text-white' : 'text-[var(--muted)]'}`}>{option === 'teams' ? 'By Team' : option === 'linear' ? 'Linear' : 'Board'}</button>)}
          </div>}
        </div>
      </div>

      {!data ? (
        <EmptyState title="No completed LeagueZone drafts" message="No LeagueZone-managed draft has been completed for this league yet. Imported provider draft history is still available." />
      ) : view === 'teams' ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {data.team_hauls.map((haul) => <Card key={haul.team}><CardHeader><CardTitle>{haul.team}</CardTitle></CardHeader><CardContent><ul className="space-y-2 text-sm">{haul.picks.length === 0 ? <li className="text-[var(--muted)]">No selections.</li> : haul.picks.map((pick, index) => <li key={`${haul.team}-${pick.round}-${pick.pick}-${index}`}><span className="font-semibold text-[var(--muted)]">R{pick.round}.{String(pick.pick).padStart(2, '0')}</span>{' · '}{pick.playerId ? <PlayerLink playerId={pick.playerId}>{pick.player}</PlayerLink> : pick.player}</li>)}</ul></CardContent></Card>)}
        </div>
      ) : view === 'linear' ? (
        <Card><CardContent><ol className="divide-y divide-[var(--border)]">{data.linear_picks.map((pick) => <li key={pick.pick_no} className="flex min-w-0 items-center gap-3 py-2.5"><span className="w-10 shrink-0 text-xs font-black text-[var(--muted)]">#{pick.pick_no}</span><span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border)]"><TeamLogo teamName={pick.team} size={24} /></span><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-[var(--text)]">{pick.playerId ? <PlayerLink playerId={pick.playerId}>{pick.player}</PlayerLink> : pick.player}</div><div className="truncate text-xs text-[var(--muted)]">{pick.team} · R{pick.round}.{String(pick.pick).padStart(2, '0')}{pick.pos ? ` · ${pick.pos}` : ''}</div></div></li>)}</ol></CardContent></Card>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="grid gap-3" style={{ minWidth: `${Math.max(280, data.rounds * 255)}px`, gridTemplateColumns: `repeat(${Math.max(1, data.rounds)}, minmax(240px, 1fr))` }}>
            {Array.from({ length: data.rounds }, (_, index) => index + 1).map((round) => <Card key={round}><CardHeader><CardTitle>Round {round}</CardTitle></CardHeader><CardContent><ol className="space-y-2">{data.linear_picks.filter((pick) => pick.round === round).map((pick) => <li key={pick.pick_no} className="rounded-lg border border-[var(--border)] p-2"><div className="flex items-center gap-2"><span className="text-xs font-black text-[var(--muted)]">{round}.{String(pick.pick).padStart(2, '0')}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text)]">{pick.playerId ? <PlayerLink playerId={pick.playerId}>{pick.player}</PlayerLink> : pick.player}</span></div><div className="mt-1 truncate text-xs text-[var(--muted)]">{pick.team}{pick.pos ? ` · ${pick.pos}` : ''}</div></li>)}</ol></CardContent></Card>)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DraftHubContent() {
  const searchParams = useSearchParams();
  const viewParam = searchParams.get('view');
  const source = searchParams.get('source');
  const active: 'next' | 'past' | 'team-prospect-draftboard' = viewParam === 'past' || viewParam === 'team-prospect-draftboard' ? viewParam : 'next';

  if (active === 'past' && source === 'provider') return <DraftContent />;

  return (
    <div className="container mx-auto px-4 py-8">
      <SectionHeader title="Draft Central" />
      <DraftHubNav active={active} />
      <div className="mt-6">
        {active === 'next' ? <UpcomingDraftView /> : active === 'past' ? <ManagedHistoryView /> : <TeamProspectDraftboard />}
      </div>
    </div>
  );
}
