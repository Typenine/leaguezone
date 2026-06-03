'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import CountdownTimer from '@/components/ui/countdown-timer';
import { CURRENT_SEASON, LEAGUE_IDS, getLeagueIdForSeason } from '@/lib/constants/league';
import EmptyState from '@/components/ui/empty-state';
import LoadingState from '@/components/ui/loading-state';
import ErrorState from '@/components/ui/error-state';
import { getLeagueDrafts, getDraftPicks, getTeamsData, getAllPlayers, SleeperPlayer } from '@/lib/utils/sleeper-api';
import SectionHeader from '@/components/ui/SectionHeader';
import { Tabs } from '@/components/ui/Tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Label from '@/components/ui/Label';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { getTeamColors, getTeamColorStyle, getTeamLogoPath } from '@/lib/utils/team-utils';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { useRouter, useSearchParams } from 'next/navigation';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle, Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react';
import TeamProspectDraftboard from '@/components/draft/TeamProspectDraftboard';

// Draft data types
type TeamHaul = {
  team: string;
  picks: { round: number; pick: number; player: string; price?: number }[];
};

type LinearPick = {
  pick_no: number;
  round: number;
  pick: number; // pick within round
  team: string;
  player: string;
  price?: number;
  pos?: string;
};

type DraftYearData = {
  rounds: number;
  picks_per_round: number;
  team_hauls: TeamHaul[];
  // Auction metadata: if true, picks may include price
  isAuction?: boolean;
  linear_picks: LinearPick[];
};

type SleeperDraftSettings = {
  rounds?: number;
};

type DraftDateSettings = {
  nextDraft: string | null;
  nextDraftConfigured: boolean;
};

// Threshold: only show countdown if draft is > 24 hours away
const DRAFT_COUNTDOWN_THRESHOLD_MS = 24 * 60 * 60 * 1000;

function isDraftDateMeaningful(date: Date): boolean {
  try {
    const now = Date.now();
    const diff = date.getTime() - now;
    return Number.isFinite(diff) && diff > DRAFT_COUNTDOWN_THRESHOLD_MS;
  } catch {
    return false;
  }
}

// ── Draft date suggestion form ────────────────────────────────────────────────
function DraftSuggestForm({
  isLoggedIn,
  isAdmin,
  onDraftDateConfirmed,
}: {
  isLoggedIn: boolean;
  isAdmin: boolean;
  onDraftDateConfirmed?: (date: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<Array<{ id: string; teamName: string; date: string; notes?: string; approvedAt?: string }>>([]);
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/draft/suggest').then(r => r.json()).then(d => {
      if (Array.isArray(d.suggestions)) setSuggestions(d.suggestions);
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) { setMsg('Please select a date and time'); setStatus('error'); return; }
    setStatus('saving');
    const res = await fetch('/api/draft/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, notes }),
    });
    const data = await res.json();
    if (res.ok) {
      setStatus('ok');
      setMsg('Suggestion submitted!');
      setDate('');
      setNotes('');
      if (Array.isArray(data.suggestions)) setSuggestions(data.suggestions);
    } else {
      setStatus('error');
      setMsg(data?.error || 'Failed to submit suggestion');
    }
  };

  const handleApprove = async (suggId: string, suggDate: string) => {
    const res = await fetch('/api/draft/suggest/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: suggId, date: suggDate }),
    });
    const data = await res.json();
    if (res.ok && Array.isArray(data.suggestions)) {
      setSuggestions(data.suggestions);
      onDraftDateConfirmed?.(suggDate);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Draft Date Suggestions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-[var(--text)]">Suggested dates:</p>
            <ul className="space-y-2">
              {suggestions.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium text-[var(--text)]">{new Date(s.date).toLocaleString()}</span>
                    <span className="text-[var(--muted)] ml-2">by {s.teamName}</span>
                    {s.notes && <p className="text-xs text-[var(--muted)] mt-0.5">{s.notes}</p>}
                    {s.approvedAt && <span className="text-xs text-green-500 ml-2">Approved</span>}
                  </div>
                  {isAdmin && !s.approvedAt && (
                    <Button size="sm" variant="secondary" onClick={() => handleApprove(s.id, s.date)}>
                      Approve
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {isLoggedIn ? (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label htmlFor="draft-suggest-date">Suggest a Date &amp; Time</Label>
              <input
                id="draft-suggest-date"
                type="datetime-local"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none text-sm"
              />
            </div>
            <div>
              <Label htmlFor="draft-suggest-notes">Notes (optional)</Label>
              <input
                id="draft-suggest-notes"
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Saturday works best for me"
                maxLength={200}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none text-sm"
              />
            </div>
            {msg && (
              <p className={`text-sm ${status === 'ok' ? 'text-green-500' : 'text-red-400'}`}>{msg}</p>
            )}
            <Button type="submit" disabled={status === 'saving'}>
              {status === 'saving' ? 'Submitting…' : 'Submit Suggestion'}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-[var(--muted)]">Sign in to suggest a draft date.</p>
        )}
      </CardContent>
    </Card>
  );
}

// Suggestions section will use EmptyState (no mock content)

export default function DraftContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const years = useMemo(
    () => [...Object.keys(LEAGUE_IDS.PREVIOUS)].sort((a, b) => parseInt(b, 10) - parseInt(a, 10)),
    [],
  );
  const [selectedYear, setSelectedYear] = useState(() => years[0] ?? '2025');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftsByYear, setDraftsByYear] = useState<Record<string, DraftYearData | null>>({});
  const playersRef = useRef<Record<string, SleeperPlayer> | null>(null);
  const loadedYearsRef = useRef<Set<string>>(new Set());
  const [draftView, setDraftView] = useState<'teams' | 'linear'>('teams');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [draftDateSettings, setDraftDateSettings] = useState<DraftDateSettings>({
    nextDraft: null,
    nextDraftConfigured: false,
  });

  const outerTabParam = searchParams?.get('view') || '';
  const nextTabParam = searchParams?.get('next') || '';
  const activeOuterTab = outerTabParam === 'next' || outerTabParam === 'past' || outerTabParam === 'team-prospect-draftboard'
    ? outerTabParam
    : 'next';
  const activeNextTab = nextTabParam === 'order' ? nextTabParam : 'order';

  const replaceDraftQuery = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '') params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `/draft?${qs}` : '/draft', { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    fetch('/api/admin-login').then(r => r.json()).then(j => setIsAdmin(Boolean(j?.isAdmin))).catch(() => setIsAdmin(false));
    fetch('/api/auth/me').then(r => r.json()).then(j => setIsLoggedIn(Boolean(j?.authenticated))).catch(() => setIsLoggedIn(false));
    fetch('/api/settings/dates')
      .then(r => r.json())
      .then((d: Partial<DraftDateSettings>) => {
        setDraftDateSettings({
          nextDraft: typeof d.nextDraft === 'string' ? d.nextDraft : null,
          nextDraftConfigured: Boolean(d.nextDraftConfigured),
        });
      })
      .catch(() => setDraftDateSettings({ nextDraft: null, nextDraftConfigured: false }));
  }, []);

  // Removed local classNames helper – primitives use tokenized styles

  // Download an ICS calendar file for the next draft
  const handleAddToCalendar = () => {
    try {
      if (!draftDateSettings.nextDraftConfigured || !draftDateSettings.nextDraft) return;
      const formatICSDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
      const draftStart = new Date(draftDateSettings.nextDraft);
      const draftEnd = new Date(draftStart.getTime() + 2 * 60 * 60 * 1000); // 2 hours
      const now = new Date();
      const year = draftStart.getFullYear();
      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Fantasy League//Draft//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:draft-${year}@fantasyleague`,
        `DTSTAMP:${formatICSDate(now)}`,
        `DTSTART:${formatICSDate(draftStart)}`,
        `DTEND:${formatICSDate(draftEnd)}`,
        `SUMMARY:Fantasy League Rookie Draft ${year}`,
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');

      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `draft-${year}.ics`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to create calendar file', e);
      alert('Could not generate calendar file.');
    }
  };

  useEffect(() => {
    const leagueId = getLeagueIdForSeason(selectedYear);

    if (!leagueId) {
      setDraftsByYear(prev => ({ ...prev, [selectedYear]: null }));
      return;
    }
    const resolvedLeagueId = leagueId;

    if (loadedYearsRef.current.has(selectedYear)) return;
    loadedYearsRef.current.add(selectedYear);

    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [drafts, teams] = await Promise.all([
          getLeagueDrafts(resolvedLeagueId),
          getTeamsData(resolvedLeagueId),
        ]);

        if (!playersRef.current) {
          playersRef.current = await getAllPlayers();
        }

        const draft = drafts[0];
        if (!draft) {
          if (!cancelled) setDraftsByYear(prev => ({ ...prev, [selectedYear]: null }));
          return;
        }

        const picks = await getDraftPicks(draft.draft_id);
        const rounds = picks.reduce((max, p) => Math.max(max, p.round), 0);
        const picksInRound1 = picks.filter(p => p.round === 1).length || teams.length;

        const byTeam = new Map<number, { round: number; pick: number; player: string; price?: number }[]>();
        const rosterIdToTeam = new Map<number, string>(teams.map(t => [t.rosterId, t.teamName]));
        const linearPicks: LinearPick[] = [];
        for (const p of picks) {
          const arr = byTeam.get(p.roster_id) || [];
          const player = playersRef.current?.[p.player_id];
          const name = player ? `${player.first_name} ${player.last_name}` : 'Unknown Player';
          // Attach price for auction drafts when present on pick
          // Sleeper stores auction bid in metadata.amount (string); fallback to root amount/price
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const anyPick = p as any;
          const metaAmountRaw = anyPick?.metadata?.amount;
          const metaAmount = typeof metaAmountRaw === 'string' && metaAmountRaw.trim() !== '' ? Number(metaAmountRaw) : undefined;
          const rootAmountRaw = anyPick?.amount ?? anyPick?.price;
          const rootAmount = typeof rootAmountRaw === 'string' ? Number(rootAmountRaw) : (typeof rootAmountRaw === 'number' ? rootAmountRaw : undefined);
          const price = Number.isFinite(metaAmount) ? (metaAmount as number) : (Number.isFinite(rootAmount) ? (rootAmount as number) : undefined);
          arr.push({ round: p.round, pick: p.draft_slot, player: name, price });
          byTeam.set(p.roster_id, arr);

          const teamName = rosterIdToTeam.get(p.roster_id) || 'Unknown Team';
          const overall = (typeof p.pick_no === 'number' && Number.isFinite(p.pick_no))
            ? (p.pick_no as number)
            : ((p.round - 1) * picksInRound1 + p.draft_slot);
          linearPicks.push({ pick_no: overall, round: p.round, pick: p.draft_slot, team: teamName, player: name, price, pos: player?.position });
        }

        const team_hauls: TeamHaul[] = [];
        for (const t of teams) {
          const arr = byTeam.get(t.rosterId) || [];
          team_hauls.push({
            team: t.teamName,
            picks: arr.sort((a, b) => (a.round === b.round ? a.pick - b.pick : a.round - b.round)),
          });
        }

        const data: DraftYearData = {
          rounds: rounds || ((draft.settings as SleeperDraftSettings | null | undefined)?.rounds ?? 0),
          picks_per_round: picksInRound1,
          team_hauls,
          isAuction: (draft.type || '').toLowerCase() === 'auction' || picks.some((pp) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const anyp = pp as any;
            return anyp?.metadata?.amount != null || anyp?.amount != null || anyp?.price != null;
          }),
          linear_picks: linearPicks.sort((a, b) => a.pick_no - b.pick_no),
        };

        if (!cancelled) setDraftsByYear(prev => ({ ...prev, [selectedYear]: data }));
      } catch (e) {
        console.error('Error loading draft data', e);
        if (!cancelled) {
          setError('Unable to load draft data at this time.');
          setDraftsByYear(prev => ({ ...prev, [selectedYear]: null }));
        }
      } finally {
        // If this load was cancelled (tab/view change or rapid year switch),
        // allow a clean retry next time this year is selected.
        if (cancelled) loadedYearsRef.current.delete(selectedYear);
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [selectedYear]);

  return (
    <div className="container mx-auto px-4 py-8">
      <SectionHeader title="Draft Central" />
      <div className="mt-6">
        <Tabs
          activeId={activeOuterTab}
          onChange={(id) => {
            if (id === 'next') replaceDraftQuery({ view: 'next', next: activeNextTab || 'order' });
            else replaceDraftQuery({ view: id, next: null });
          }}
          tabs={[
            {
              id: 'next',
              label: 'Next Draft',
              content: (() => {
                const configuredDraftDate = draftDateSettings.nextDraft ? new Date(draftDateSettings.nextDraft) : null;
                const draftDateConfirmed = Boolean(
                  draftDateSettings.nextDraftConfigured
                  && configuredDraftDate
                  && isDraftDateMeaningful(configuredDraftDate)
                );
                return (
                  <div className="space-y-6">
                    {draftDateConfirmed ? (
                      <CountdownTimer
                        targetDate={configuredDraftDate!}
                        title="Countdown to Draft Day"
                        className="mb-2"
                      />
                    ) : (
                      <Card>
                        <CardContent>
                          <div className="flex items-center gap-3 py-2">
                            <span className="text-3xl">📅</span>
                            <div>
                              <p className="font-semibold text-[var(--text)]">Draft Date TBD</p>
                              <p className="text-sm text-[var(--muted)]">
                                No draft date has been confirmed yet. Use the suggestion form below to propose a date.
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    <div className="space-y-4">
                      {draftDateConfirmed && (
                        <Card>
                          <CardHeader>
                            <CardTitle>Draft Info</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-[var(--muted)] mb-4">
                              Draft details configured by the commissioner. Add to your calendar so you don&apos;t miss it.
                            </p>
                            <Button onClick={handleAddToCalendar} variant="primary">Add to Calendar (.ics)</Button>
                          </CardContent>
                        </Card>
                      )}
                      <DraftSuggestForm
                        isLoggedIn={isLoggedIn}
                        isAdmin={isAdmin}
                        onDraftDateConfirmed={(date) => setDraftDateSettings({
                          nextDraft: new Date(date).toISOString(),
                          nextDraftConfigured: true,
                        })}
                      />
                      <DraftOrderView />
                    </div>
                  </div>
                );
              })(),
            },
            {
              id: 'past',
              label: 'Previous Drafts',
              content: (
                <Card>
                  <CardContent>
                    <div className="mb-6">
                      <Label htmlFor="year-select" className="mb-1 block">Select Year</Label>
                      <Select
                        id="year-select"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                      >
                        {years.map((year) => (
                          <option key={year} value={year}>
                            {year === '2023' ? 'Inaugural Draft' : `${year} Draft`}
                          </option>
                        ))}
                      </Select>
                    </div>
                    {loading ? (
                      <LoadingState message="Loading draft data..." />
                    ) : error ? (
                      <ErrorState message={error} />
                    ) : draftsByYear[selectedYear] === undefined ? (
                      <EmptyState title="Select a year" message="Choose a year to view draft results." />
                    ) : draftsByYear[selectedYear] === null ? (
                      <EmptyState title="No draft data" message="No draft data available for the selected year." />
                    ) : (
                      <div className="space-y-8">
                        <div>
                          <h3 className="text-base font-semibold text-[var(--text)] mb-3">Draft Structure</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <Card>
                              <CardContent>
                                <div className="text-sm text-[var(--muted)]">Rounds</div>
                                <div className="text-2xl font-bold text-[var(--text)]">{draftsByYear[selectedYear]?.rounds}</div>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent>
                                <div className="text-sm text-[var(--muted)]">Picks Per Round</div>
                                <div className="text-2xl font-bold text-[var(--text)]">{draftsByYear[selectedYear]?.picks_per_round}</div>
                              </CardContent>
                            </Card>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-base font-semibold text-[var(--text)]">
                              {draftView === 'teams' ? 'Team Hauls' : 'Linear Picks'}
                            </h3>
                            <div className="inline-flex rounded-md border border-[var(--border)] overflow-hidden">
                              <Button
                                variant={draftView === 'teams' ? 'primary' : 'ghost'}
                                size="sm"
                                className="px-3"
                                onClick={() => setDraftView('teams')}
                              >
                                By Team
                              </Button>
                              <Button
                                variant={draftView === 'linear' ? 'primary' : 'ghost'}
                                size="sm"
                                className="px-3"
                                onClick={() => setDraftView('linear')}
                              >
                                Linear
                              </Button>
                            </div>
                          </div>
                          {draftView === 'teams' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {(draftsByYear[selectedYear]?.team_hauls ?? []).map((teamHaul, index) => {
                                const colors = getTeamColors(teamHaul.team);
                                const headerStyle = getTeamColorStyle(teamHaul.team, 'primary');
                                return (
                                  <Card key={index} className="hover-lift" style={{ borderColor: colors.primary }}>
                                    <CardHeader className="rounded-t-[var(--radius-card)]" style={headerStyle}>
                                      <CardTitle style={{ color: headerStyle.color }}>{teamHaul.team}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <ul className="space-y-1">
                                        {teamHaul.picks.map((pick, pickIndex) => (
                                          <li key={pickIndex} className="text-sm">
                                            {`Round ${pick.round}, Pick ${pick.pick}: ${pick.player}${selectedYear === '2023' && draftsByYear[selectedYear]?.isAuction && pick.price != null ? ` — $${pick.price}` : ''}`}
                                          </li>
                                        ))}
                                      </ul>
                                    </CardContent>
                                  </Card>
                                );
                              })}
                            </div>
                          ) : (
                            <Card className="overflow-x-auto">
                              <CardContent>
                                {(() => {
                                  const picks = draftsByYear[selectedYear]?.linear_picks ?? [];
                                  const byRound = new Map<number, LinearPick[]>();
                                  for (const p of picks) {
                                    const arr = byRound.get(p.round) || [];
                                    arr.push(p);
                                    byRound.set(p.round, arr);
                                  }
                                  const rounds = Array.from(byRound.keys()).sort((a, b) => a - b);
                                  return rounds.map((r) => (
                                    <div key={r} className="mb-6">
                                      <div className="sticky top-0 z-10 bg-[var(--surface)]/80 backdrop-blur-sm text-base font-semibold text-[var(--muted)] -mx-2 px-2 py-1.5 border-b border-[var(--border)]">{`Round ${r}`}</div>
                                      <ul className="space-y-2 mt-2">
                                        {(byRound.get(r) || []).map((p) => {
                                          const colors = getTeamColors(p.team);
                                          const nameStyle = getTeamColorStyle(p.team);
                                          const priceEnabled = selectedYear === '2023' && draftsByYear[selectedYear]?.isAuction && p.price != null;
                                          return (
                                            <li
                                              key={p.pick_no}
                                              className="text-sm rounded-md"
                                              style={{
                                                borderLeft: `4px solid ${colors.secondary}`,
                                                backgroundColor: nameStyle.backgroundColor as string,
                                                color: nameStyle.color as string,
                                              }}
                                            >
                                              <div className="pl-3 py-2 flex items-start justify-between gap-3">
                                                <div className="flex items-start min-w-0">
                                                  <div 
                                                    className="w-12 h-12 rounded-full flex items-center justify-center mr-3 overflow-hidden flex-shrink-0"
                                                    style={nameStyle}
                                                  >
                                                    <Image
                                                      src={getTeamLogoPath(p.team)}
                                                      alt={p.team}
                                                      width={36}
                                                      height={36}
                                                      className="object-contain"
                                                      onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.style.display = 'none';
                                                        const parent = target.parentElement;
                                                        if (parent) {
                                                          const fallback = document.createElement('div');
                                                          fallback.className = 'flex items-center justify-center h-full w-full';
                                                          fallback.innerHTML = `<span class=\"text-xs font-bold\">${p.team.charAt(0)}</span>`;
                                                          parent.appendChild(fallback);
                                                        }
                                                      }}
                                                    />
                                                  </div>
                                                  <div className="min-w-0">
                                                    <div className="flex items-center justify-between gap-3">
                                                      <span className="font-medium truncate">{p.team}</span>
                                                      <span className="text-sm whitespace-nowrap opacity-90 font-semibold">{`Pick ${p.pick_no} • Rd ${p.round}, Pk ${p.pick}`}</span>
                                                    </div>
                                                    <div className="text-sm truncate">
                                                      <span className="truncate inline-block max-w-full align-middle">{p.player}</span>
                                                      {p.pos && (
                                                        <span
                                                          className="ml-2 align-middle px-1.5 py-0.5 rounded text-[10px]"
                                                          style={{
                                                            backgroundColor: (nameStyle.color as string) === '#000000' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.12)',
                                                            color: nameStyle.color as string,
                                                          }}
                                                        >
                                                          {p.pos}
                                                        </span>
                                                      )}
                                                    </div>
                                                  </div>
                                                </div>
                                                {priceEnabled && (
                                                  <div className="flex-shrink-0">
                                                    <span
                                                      className="inline-block px-2 py-0.5 rounded-full text-xs"
                                                      style={{
                                                        backgroundColor: (nameStyle.color as string) === '#000000' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.12)',
                                                        color: nameStyle.color as string,
                                                      }}
                                                    >
                                                      {`$${p.price}`}
                                                    </span>
                                                  </div>
                                                )}
                                              </div>
                                            </li>
                                          );
                                        })}
                                      </ul>
                                      <div className="h-px bg-[var(--border)] opacity-70 mt-4" />
                                    </div>
                                  ));
                                })()}
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ),
            },
            {
              id: 'team-prospect-draftboard',
              label: 'Team Prospect Draftboard',
              content: (
                <TeamProspectDraftboard />
              ),
            },
          ]}
        />

        {/* Admin Quick Links - Outside of tabs for direct access */}
        {isAdmin && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>🎯 Live Draft Room</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-[var(--muted)]">
                    Access the live draft room to participate in the draft, view picks in real-time, and manage your queue.
                  </p>
                  <a href="/draft/room" className="btn btn-primary text-sm px-3 py-1.5 inline-block">
                    Enter Draft Room →
                  </a>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>⚙️ Draft Setup &amp; Control</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-[var(--muted)]">
                    Commissioner controls for setting up and managing the live draft. Create drafts, upload custom player lists, control the clock, and more.
                  </p>
                  <div className="flex gap-3">
                    <a href="/admin/draft" className="btn btn-primary text-sm px-3 py-1.5 inline-block">
                      Open Draft Control Panel
                    </a>
                    <a href="/draft/overlay" target="_blank" rel="noopener noreferrer" className="btn pill pill-hover text-[var(--text)] text-sm px-3 py-1.5 inline-block">
                      Open Presentation Overlay
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

type DraftOrderHistoryHop = {
  tradeId: string;
  timestamp: number;
  fromTeam: string;
  toTeam: string;
  summary?: string;
};

type DraftOrderTradeModal = {
  tradeId: string;
  title: string;
  summary?: string;
  history: DraftOrderHistoryHop[];
};

const TRADE_SUMMARY_RECEIVED = ' received: ';

function parseTradeSummarySides(summary: string | undefined): Array<{ team: string; items: string[] }> | null {
  if (!summary?.trim()) return null;
  const parts = summary.split(/\s*\|\s*/).map((s) => s.trim()).filter(Boolean);
  const sides: Array<{ team: string; items: string[] }> = [];
  for (const part of parts) {
    const idx = part.indexOf(TRADE_SUMMARY_RECEIVED);
    if (idx === -1) continue;
    const teamName = part.slice(0, idx).trim();
    const itemsRaw = part.slice(idx + TRADE_SUMMARY_RECEIVED.length).trim();
    if (!teamName) continue;
    const items = itemsRaw.split(',').map((s) => s.trim()).filter(Boolean);
    sides.push({ team: teamName, items });
  }
  return sides.length ? sides : null;
}

function tintFromTeamStyle(style: ReturnType<typeof getTeamColorStyle>): string | undefined {
  const c = style.backgroundColor;
  return typeof c === 'string' ? `${c}14` : undefined;
}

function TradeBreakdown({ summary }: { summary: string | undefined }) {
  const sides = parseTradeSummarySides(summary);
  if (!summary?.trim()) {
    return <p className="text-sm text-[var(--muted)]">No summary for this trade.</p>;
  }
  if (!sides) {
    return <p className="text-sm text-[var(--muted)] leading-relaxed whitespace-pre-wrap">{summary}</p>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {sides.map((side, sideIdx) => {
        const style = getTeamColorStyle(side.team);
        const tint = tintFromTeamStyle(style);
        return (
          <div
            key={`${side.team}-${sideIdx}`}
            className="rounded-lg border border-[var(--border)] p-3"
            style={tint ? { backgroundColor: tint } : undefined}
          >
            <div className="flex items-center gap-2 min-w-0 mb-2">
              <div className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden shrink-0 border border-[var(--border)]/50" style={style}>
                <Image
                  src={getTeamLogoPath(side.team)}
                  alt=""
                  width={28}
                  height={28}
                  className="object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
              <span className="font-semibold text-[var(--text)] truncate">{side.team}</span>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)] mb-1">Received</p>
            <ul className="list-disc pl-4 space-y-1 text-sm text-[var(--text)]">
              {side.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function TeamHopChip({ team }: { team: string }) {
  const style = getTeamColorStyle(team);
  const tint = tintFromTeamStyle(style);
  return (
    <span
      className="inline-flex items-center gap-1.5 min-w-0 max-w-[45%] rounded-full border border-[var(--border)]/60 pl-0.5 pr-2 py-0.5"
      style={tint ? { backgroundColor: tint } : undefined}
    >
      <span className="w-7 h-7 rounded-full flex items-center justify-center overflow-hidden shrink-0" style={style}>
        <Image
          src={getTeamLogoPath(team)}
          alt=""
          width={22}
          height={22}
          className="object-contain"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </span>
      <span className="text-xs font-medium text-[var(--text)] break-words leading-tight max-w-[min(200px,45vw)]">{team}</span>
    </span>
  );
}

function DraftOrderView() {
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [orderSeason, setOrderSeason] = useState<number>(Number(CURRENT_SEASON));
  const [tradeModal, setTradeModal] = useState<DraftOrderTradeModal | null>(null);
  const [data, setData] = useState<{
    season: number;
    rounds: number;
    rosterCount: number;
    generatedAt?: string;
    orderSource?: 'projected' | 'commissioner';
    slotOrder: Array<{ slot: number; rosterId: number; team: string; record: { wins: number; losses: number; ties: number; fpts: number; fptsAgainst: number } }>;
    roundsData: Array<{ round: number; picks: Array<{ slot: number; round: number; originalTeam: string; ownerTeam: string; originalRosterId: number; ownerRosterId: number; history: DraftOrderHistoryHop[]; tradeSummary?: string }> }>;
    summary: { factoids: string[]; picksPerTeam: Array<{ team: string; overall: number; firstTwo: number }>; leaders: { mostOverall: { team: string; count: number } | null; mostFirstTwo: { team: string; count: number } | null } };
    transfers: Array<{ round: number; slot: number | null; tradeId: string; timestamp: number; fromTeam: string; toTeam: string; originalTeam: string; ownerTeam: string; summary?: string }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/draft/next-order?season=${orderSeason}`, { cache: 'no-store' });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || 'Failed to load draft order');
        if (!cancelled) setData(j);
      } catch {
        if (!cancelled) setError('Unable to load draft order right now.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshNonce, orderSeason]);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) return;
      setRefreshNonce((n) => n + 1);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  if (loading && !data) return <LoadingState message="Loading draft order..." />;
  if (error && !data) return <ErrorState message={error} />;
  if (!data) return <EmptyState title="No data" message="Draft order is not available yet." />;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div className="flex items-center gap-2 mr-3">
          <Label htmlFor="draft-order-season" className="text-sm text-[var(--muted)]">Season</Label>
          <Select
            id="draft-order-season"
            value={String(orderSeason)}
            onChange={(e) => setOrderSeason(Number(e.target.value))}
            className="w-[150px]"
          >
            <option value={CURRENT_SEASON}>{CURRENT_SEASON} Draft</option>
            <option value={String(Number(CURRENT_SEASON) + 1)}>{Number(CURRENT_SEASON) + 1} Draft</option>
          </Select>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={loading}
          onClick={() => setRefreshNonce((n) => n + 1)}
        >
          {loading ? 'Refreshing…' : 'Refresh Draft Order'}
        </Button>
      </div>
      <Dialog open={tradeModal !== null} onClose={() => setTradeModal(null)} className="relative z-[200]">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-black/60 z-[200] data-closed:opacity-0 data-enter:duration-200 data-enter:ease-out data-leave:duration-150 data-leave:ease-in"
        />
        <div className="fixed inset-0 z-[201] flex min-h-full items-center justify-center p-4 pointer-events-none">
          <DialogPanel
            transition
            className="pointer-events-auto w-full max-w-2xl rounded-lg border border-[var(--border)] league-surface shadow-xl p-5 max-h-[90vh] overflow-y-auto data-closed:opacity-0 data-closed:scale-95 data-enter:duration-200 data-enter:ease-out data-leave:duration-150 data-leave:ease-in"
          >
            {tradeModal ? (
              <>
                <DialogTitle className="text-lg font-semibold text-[var(--text)] pr-8">
                  {tradeModal.title}
                </DialogTitle>
                <div className="mt-4 space-y-5 text-sm text-[var(--text)]">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-2">Who got what</div>
                    {tradeModal.summary ? (
                      <TradeBreakdown summary={tradeModal.summary} />
                    ) : (
                      <p className="text-[var(--muted)]">No full trade summary available for the latest transaction on this pick.</p>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-2">Transfer chain</div>
                    <p className="text-xs text-[var(--muted)] mb-2">Click a step to see that trade. Order is earliest → latest.</p>
                    <ul className="rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--surface)]/40 divide-y divide-[var(--border)]">
                      {tradeModal.history.map((h, i) => (
                        <li key={`${h.tradeId}-${h.timestamp}-${i}`} className="list-none">
                          <Disclosure as="div" defaultOpen={false} className="group">
                            <DisclosureButton className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-[var(--surface)]/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus)]">
                              <div className="flex flex-1 items-center justify-center gap-1.5 sm:gap-2 min-w-0">
                                <TeamHopChip team={h.fromTeam} />
                                <span className="text-[var(--muted)] shrink-0 text-xs" aria-hidden="true">→</span>
                                <TeamHopChip team={h.toTeam} />
                              </div>
                              <ChevronDownIcon className="h-4 w-4 shrink-0 text-[var(--muted)] transition duration-200 group-data-[open]:rotate-180" />
                            </DisclosureButton>
                            <DisclosurePanel
                              transition
                              className="border-t border-[var(--border)] bg-black/20 px-3 py-3 data-closed:opacity-0 data-enter:duration-150 data-enter:ease-out data-leave:duration-100 data-leave:ease-in"
                            >
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)] mb-2">
                                This trade · {new Date(h.timestamp).toLocaleString()}
                              </p>
                              {h.summary ? (
                                <TradeBreakdown summary={h.summary} />
                              ) : (
                                <p className="text-sm text-[var(--muted)]">
                                  Summary not available for this transaction.
                                </p>
                              )}
                            </DisclosurePanel>
                          </Disclosure>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2 justify-end">
                  <Button type="button" variant="secondary" onClick={() => setTradeModal(null)}>
                    Close
                  </Button>
                  <Link
                    href={`/trades/${tradeModal.tradeId}`}
                    className="btn btn-primary text-sm px-3 py-1.5 inline-flex items-center justify-center"
                  >
                    Open full trade page
                  </Link>
                </div>
              </>
            ) : null}
          </DialogPanel>
        </div>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>
            Projected Draft Order • {data.season}
            {data.orderSource === 'commissioner' && (
              <span className="ml-2 text-xs font-semibold text-[var(--gold)]">Commissioner set</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {data.roundsData.map((round) => (
              <div key={round.round} className="league-surface border border-[var(--border)] rounded-lg overflow-hidden">
                <div className="px-3 py-2 text-sm font-semibold border-b border-[var(--border)]">Round {round.round}</div>
                <ul className="divide-y divide-[var(--border)]">
                  {round.picks.map((p) => {
                    const style = getTeamColorStyle(p.ownerTeam);
                    const latestTradeId = p.history && p.history.length > 0
                      ? p.history[p.history.length - 1].tradeId
                      : null;
                    const inner = (
                      <>
                        <div className="text-xs font-semibold w-8 shrink-0 text-[var(--muted)]">#{p.slot}</div>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden shrink-0" style={style}>
                          <Image src={getTeamLogoPath(p.ownerTeam)} alt={p.ownerTeam} width={24} height={24} className="object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate text-[var(--text)]">{p.ownerTeam}</div>
                          {p.originalTeam && p.originalTeam !== p.ownerTeam && (
                            <div className="text-xs text-[var(--muted)] truncate">from {p.originalTeam}</div>
                          )}
                        </div>
                      </>
                    );
                    return (
                      <li key={`${round.round}-${p.slot}`} className="flex items-center px-3 py-2" style={{ backgroundColor: (style.backgroundColor as string) + '11' }}>
                        {latestTradeId ? (
                          <button
                            type="button"
                            className="flex items-center gap-3 w-full text-left hover:opacity-75 transition-opacity cursor-pointer rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
                            onClick={() => setTradeModal({
                              tradeId: latestTradeId,
                              title: `Pick trade — Round ${round.round}, Slot ${p.slot}`,
                              summary: p.tradeSummary,
                              history: p.history,
                            })}
                          >
                            {inner}
                          </button>
                        ) : (
                          <div className="flex items-center gap-3 w-full">{inner}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Factoids</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {data.summary.factoids.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pick Transfer History</CardTitle>
        </CardHeader>
        <CardContent>
          {data.transfers.length === 0 ? (
            <div className="text-sm text-[var(--muted)]">No trades involving next year’s picks yet.</div>
          ) : (
            <ul className="space-y-2">
              {data.transfers.map((t, idx) => (
                <li key={idx} className="text-sm league-surface border border-[var(--border)] rounded-md px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">R{t.round}{typeof t.slot === 'number' ? `, S${t.slot}` : ''}</span>
                      <span className="text-[var(--muted)]"> • orig {t.originalTeam}</span>
                    </div>
                    <div className="text-xs text-[var(--muted)]">{new Date(t.timestamp).toLocaleDateString()}</div>
                  </div>
                  <div className="mt-1">
                    <span>{t.fromTeam}</span>
                    <span className="mx-1">→</span>
                    <span>{t.toTeam}</span>
                    <span className="text-[var(--muted)]"> (now {t.ownerTeam})</span>
                    <button
                      type="button"
                      className="ml-2 text-[var(--accent-strong)] hover:underline"
                      aria-label={`Trade details ${t.tradeId}`}
                      onClick={() => setTradeModal({
                        tradeId: t.tradeId,
                        title: `Pick transfer — R${t.round}${typeof t.slot === 'number' ? `, S${t.slot}` : ''}`,
                        summary: t.summary,
                        history: [{
                          tradeId: t.tradeId,
                          timestamp: t.timestamp,
                          fromTeam: t.fromTeam,
                          toTeam: t.toTeam,
                          ...(t.summary ? { summary: t.summary } : {}),
                        }],
                      })}
                    >
                      Details
                    </button>
                  </div>
                  {t.summary ? (
                    <div className="mt-1 text-xs text-[var(--muted)]">{t.summary}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
