'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SectionHeader from '@/components/ui/SectionHeader';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import Select from '@/components/ui/Select';
import { CURRENT_SEASON, NEXT_DRAFT_SEASON } from '@/lib/constants/league';

type AuthState = {
  authenticated: boolean;
  isAdmin: boolean;
  claims?: { team?: string; [k: string]: unknown };
};

type LeagueInfo = {
  name: string | null;
  shortName: string | null;
};

type DraftOrderSettingsData = {
  season: number;
  orderSource?: 'projected' | 'commissioner';
  slotOrder: Array<{
    slot: number;
    rosterId: number;
    team: string;
    record: {
      wins: number;
      losses: number;
      ties: number;
      fpts: number;
      fptsAgainst: number;
    };
  }>;
};

type JoinRequestRow = {
  id: string;
  name: string;
  email: string;
  message?: string;
  sleeperLeagueId?: string;
  createdAt: string;
};

type CommissionerMember = {
  userId: string;
  teamName: string;
  displayName: string | null;
  email: string | null;
  isCommissioner: boolean;
};

// ─── PIN change form (for logged-in users) ───────────────────────────────────
function ChangePinForm({ team }: { team: string }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length !== 6 || !/^\d{6}$/.test(next)) { setMsg('PIN must be exactly 6 digits'); setStatus('error'); return; }
    if (next !== confirm) { setMsg('New PINs do not match'); setStatus('error'); return; }
    setStatus('saving');
    const res = await fetch('/api/auth/change-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPin: current, newPin: next }),
    });
    const data = await res.json();
    if (res.ok) { setStatus('ok'); setMsg('PIN updated successfully'); setCurrent(''); setNext(''); setConfirm(''); }
    else { setStatus('error'); setMsg(data?.error || 'Failed to update PIN'); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-[var(--muted)]">Changing PIN for <strong className="text-[var(--text)]">{team}</strong></p>
      <div>
        <Label htmlFor="current-pin">Current PIN</Label>
        <Input id="current-pin" type="password" inputMode="numeric" maxLength={6} value={current} onChange={e => setCurrent(e.target.value)} placeholder="••••••" />
      </div>
      <div>
        <Label htmlFor="new-pin">New PIN (6 digits)</Label>
        <Input id="new-pin" type="password" inputMode="numeric" maxLength={6} value={next} onChange={e => setNext(e.target.value)} placeholder="••••••" />
      </div>
      <div>
        <Label htmlFor="confirm-pin">Confirm New PIN</Label>
        <Input id="confirm-pin" type="password" inputMode="numeric" maxLength={6} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••" />
      </div>
      {msg && (
        <p className={`text-sm ${status === 'ok' ? 'text-green-500' : 'text-red-400'}`}>{msg}</p>
      )}
      <Button type="submit" disabled={status === 'saving'}>
        {status === 'saving' ? 'Saving…' : 'Update PIN'}
      </Button>
    </form>
  );
}

// ─── Admin: league info editor ───────────────────────────────────────────────
function LeagueInfoForm({ initial }: { initial: LeagueInfo }) {
  const [name, setName] = useState(initial.name ?? '');
  const [shortName, setShortName] = useState(initial.shortName ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('saving');
    const res = await fetch('/api/settings/league', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), shortName: shortName.trim() }),
    });
    if (res.ok) { setStatus('ok'); setMsg('League info saved'); }
    else { const d = await res.json(); setStatus('error'); setMsg(d?.error || 'Save failed'); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="league-name">League Name</Label>
        <Input id="league-name" value={name} onChange={e => setName(e.target.value)} placeholder="My Fantasy League" />
        <p className="text-xs text-[var(--muted)] mt-1">Shown in the navbar and throughout the site</p>
      </div>
      <div>
        <Label htmlFor="league-short">Short Name / Abbreviation</Label>
        <Input id="league-short" value={shortName} onChange={e => setShortName(e.target.value)} placeholder="MFL" maxLength={10} />
        <p className="text-xs text-[var(--muted)] mt-1">Used in the footer and compact displays</p>
      </div>
      {msg && (
        <p className={`text-sm ${status === 'ok' ? 'text-green-500' : 'text-red-400'}`}>{msg}</p>
      )}
      <Button type="submit" disabled={status === 'saving'}>
        {status === 'saving' ? 'Saving…' : 'Save League Info'}
      </Button>
    </form>
  );
}

// ─── Admin: important dates editor ───────────────────────────────────────────
function ImportantDatesForm() {
  const [nflWeek1, setNflWeek1] = useState('');
  const [tradeDeadline, setTradeDeadline] = useState('');
  const [playoffsStart, setPlayoffsStart] = useState('');
  const [nextDraft, setNextDraft] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  // Load current values from env defaults
  useEffect(() => {
    fetch('/api/settings/dates').then(r => r.json()).then(d => {
      if (d.nflWeek1) setNflWeek1(d.nflWeek1.slice(0, 16));
      if (d.tradeDeadline) setTradeDeadline(d.tradeDeadline.slice(0, 16));
      if (d.playoffsStart) setPlayoffsStart(d.playoffsStart.slice(0, 16));
      if (d.nextDraft) setNextDraft(d.nextDraft.slice(0, 16));
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('saving');
    const res = await fetch('/api/settings/dates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nflWeek1, tradeDeadline, playoffsStart, nextDraft }),
    });
    if (res.ok) { setStatus('ok'); setMsg('Dates saved'); }
    else { const d = await res.json(); setStatus('error'); setMsg(d?.error || 'Save failed'); }
  };

  const field = (label: string, value: string, setter: (v: string) => void, hint?: string) => (
    <div>
      <Label>{label}</Label>
      <input
        type="datetime-local"
        value={value}
        onChange={e => setter(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none text-sm"
      />
      {hint && <p className="text-xs text-[var(--muted)] mt-1">{hint}</p>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {field('NFL Week 1 Start', nflWeek1, setNflWeek1, 'Used to determine current week and season state')}
      {field('Trade Deadline', tradeDeadline, setTradeDeadline, 'Trades are locked after this date')}
      {field('Playoffs Start', playoffsStart, setPlayoffsStart)}
      {field('Next Draft Date', nextDraft, setNextDraft)}
      {msg && <p className={`text-sm ${status === 'ok' ? 'text-green-500' : 'text-red-400'}`}>{msg}</p>}
      <Button type="submit" disabled={status === 'saving'}>
        {status === 'saving' ? 'Saving…' : 'Save Dates'}
      </Button>
    </form>
  );
}

// ─── Admin: projected draft order editor ──────────────────────────────────────
function ProjectedDraftOrderForm() {
  const [season, setSeason] = useState(NEXT_DRAFT_SEASON);
  const [data, setData] = useState<DraftOrderSettingsData | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  const loadOrder = async (opts?: { ignoreOverride?: boolean }) => {
    try {
      setLoading(true);
      setStatus('idle');
      setMsg('');
      const suffix = opts?.ignoreOverride ? '&ignoreOverride=1' : '';
      const res = await fetch(`/api/draft/next-order?season=${encodeURIComponent(season)}${suffix}`, { cache: 'no-store' });
      const next = await res.json();
      if (!res.ok) throw new Error(next?.error || 'Failed to load draft order');
      const parsed = next as DraftOrderSettingsData;
      setData(parsed);
      setOrder(parsed.slotOrder.map((entry) => entry.rosterId));
    } catch (err) {
      setStatus('error');
      setMsg(err instanceof Error ? err.message : 'Unable to load draft order');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season]);

  const updateSlot = (index: number, rosterId: number) => {
    setOrder((prev) => prev.map((id, i) => (i === index ? rosterId : id)));
    setStatus('idle');
    setMsg('');
  };

  const duplicateRosterIds = new Set(
    order.filter((id, index) => order.indexOf(id) !== index)
  );

  const saveOrder = async () => {
    if (duplicateRosterIds.size > 0) {
      setStatus('error');
      setMsg('Each team can appear only once in the draft order.');
      return;
    }

    try {
      setStatus('saving');
      setMsg('');
      const res = await fetch('/api/settings/draft-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season: Number(season), rosterIds: order }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Failed to save draft order');
      setStatus('ok');
      setMsg('Projected draft order saved.');
      await loadOrder();
    } catch (err) {
      setStatus('error');
      setMsg(err instanceof Error ? err.message : 'Failed to save draft order');
    }
  };

  const resetOrder = async () => {
    try {
      setStatus('saving');
      setMsg('');
      const res = await fetch('/api/settings/draft-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season: Number(season), reset: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Failed to reset draft order');
      setStatus('ok');
      setMsg('Commissioner override removed. Using projected Sleeper order.');
      await loadOrder({ ignoreOverride: true });
    } catch (err) {
      setStatus('error');
      setMsg(err instanceof Error ? err.message : 'Failed to reset draft order');
    }
  };

  const teamsByRosterId = new Map((data?.slotOrder ?? []).map((entry) => [entry.rosterId, entry] as const));
  const seasonOptions = [Number(NEXT_DRAFT_SEASON), Number(CURRENT_SEASON)]
    .filter((year) => Number.isFinite(year))
    .map(String);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="projected-draft-season">Draft Season</Label>
          <Select
            id="projected-draft-season"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            fullWidth={false}
            className="min-w-[10rem]"
          >
            {seasonOptions.map((year) => (
              <option key={year} value={year}>{year} Draft</option>
            ))}
          </Select>
        </div>
        <Button type="button" variant="secondary" onClick={() => loadOrder({ ignoreOverride: true })} disabled={loading || status === 'saving'}>
          Load Sleeper Projection
        </Button>
      </div>

      <p className="text-sm text-[var(--muted)]">
        Set the original slot order for the projected draft. Traded picks still follow the saved trade ownership for each round.
        {data?.orderSource === 'commissioner' ? ' Current order is using a commissioner override.' : ' Current order is using the projected Sleeper order.'}
      </p>

      {loading && <p className="text-sm text-[var(--muted)]">Loading draft order...</p>}

      {data && (
        <div className="space-y-2">
          {order.map((rosterId, index) => {
            const selectedTeam = teamsByRosterId.get(rosterId);
            const hasDuplicate = duplicateRosterIds.has(rosterId);
            return (
              <div key={`slot-${index + 1}`} className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2">
                <div className="w-12 shrink-0 text-sm font-semibold text-[var(--muted)]">#{index + 1}</div>
                <Select
                  aria-label={`Draft slot ${index + 1}`}
                  value={String(rosterId)}
                  onChange={(e) => updateSlot(index, Number(e.target.value))}
                  invalid={hasDuplicate}
                >
                  {data.slotOrder.map((entry) => (
                    <option key={entry.rosterId} value={entry.rosterId}>
                      {entry.team}
                    </option>
                  ))}
                </Select>
                {selectedTeam && (
                  <div className="hidden sm:block w-28 shrink-0 text-right text-xs text-[var(--muted)]">
                    {selectedTeam.record.wins}-{selectedTeam.record.losses}
                    {selectedTeam.record.ties ? `-${selectedTeam.record.ties}` : ''}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {msg && (
        <p className={`text-sm ${status === 'ok' ? 'text-green-500' : 'text-red-400'}`}>{msg}</p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={saveOrder} disabled={!data || loading || status === 'saving'}>
          {status === 'saving' ? 'Saving...' : 'Save Projected Order'}
        </Button>
        <Button type="button" variant="ghost" onClick={resetOrder} disabled={!data || loading || status === 'saving'}>
          Reset to Sleeper Projection
        </Button>
      </div>
    </div>
  );
}

// ─── Admin: public join request inbox ─────────────────────────────────────────
function JoinRequestsPanel() {
  const [requests, setRequests] = useState<JoinRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    fetch('/api/settings/join-requests', { cache: 'no-store' })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error('Failed to load requests')))
      .then((body) => {
        if (!mounted) return;
        setRequests(Array.isArray(body.requests) ? body.requests : []);
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to load requests');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading join requests...</p>;
  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (requests.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No public join requests yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {requests.map((request) => (
        <li key={request.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-semibold text-[var(--text)]">{request.name}</p>
              <a href={`mailto:${request.email}`} className="text-sm text-[var(--accent)] hover:underline">{request.email}</a>
            </div>
            <p className="text-xs text-[var(--muted)]">{new Date(request.createdAt).toLocaleString()}</p>
          </div>
          {request.sleeperLeagueId && (
            <p className="mt-2 text-xs text-[var(--muted)]">Searched Sleeper ID: {request.sleeperLeagueId}</p>
          )}
          {request.message && (
            <p className="mt-2 text-sm text-[var(--muted)]">{request.message}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

// ─── Admin: commissioner assignment ───────────────────────────────────────────
function CommissionerAssignmentForm() {
  const [members, setMembers] = useState<CommissionerMember[]>([]);
  const [commissionerUserId, setCommissionerUserId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setMsg('');
      const res = await fetch('/api/settings/commissioner', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Failed to load commissioner settings');
      const nextMembers = Array.isArray(body.members) ? body.members as CommissionerMember[] : [];
      setMembers(nextMembers);
      setCommissionerUserId(typeof body.commissionerUserId === 'string' ? body.commissionerUserId : null);
      setSelectedUserId(nextMembers[0]?.userId || '');
    } catch (err) {
      setStatus('error');
      setMsg(err instanceof Error ? err.message : 'Failed to load commissioner settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const assign = async () => {
    if (!selectedUserId) return;
    try {
      setStatus('saving');
      setMsg('');
      const res = await fetch('/api/settings/commissioner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Failed to assign commissioner');
      setStatus('ok');
      setMsg('Commissioner assigned.');
      await load();
    } catch (err) {
      setStatus('error');
      setMsg(err instanceof Error ? err.message : 'Failed to assign commissioner');
    }
  };

  const commissioner = members.find((member) => member.userId === commissionerUserId);

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading commissioner settings...</p>;

  return (
    <div className="space-y-4">
      {commissioner ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-sm text-[var(--muted)]">Current commissioner</p>
          <p className="mt-1 font-semibold text-[var(--text)]">
            <span className="mr-1 text-[var(--gold)]" aria-label="Commissioner">★</span>
            {commissioner.teamName}
          </p>
          <p className="text-xs text-[var(--muted)]">{commissioner.displayName || commissioner.email || 'League member'}</p>
        </div>
      ) : members.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No claimed teams are available yet. A user must join a team before they can be assigned as commissioner.</p>
      ) : (
        <>
          <p className="text-sm text-[var(--muted)]">
            No commissioner is assigned. Choose one claimed team/user to grant commissioner abilities.
          </p>
          <div>
            <Label htmlFor="commissioner-user">Commissioner</Label>
            <Select id="commissioner-user" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.teamName} — {member.displayName || member.email || 'User'}
                </option>
              ))}
            </Select>
          </div>
          <Button type="button" onClick={assign} disabled={!selectedUserId || status === 'saving'}>
            {status === 'saving' ? 'Assigning...' : 'Assign Commissioner'}
          </Button>
        </>
      )}

      {msg && (
        <p className={`text-sm ${status === 'ok' ? 'text-green-500' : 'text-red-400'}`}>{msg}</p>
      )}
    </div>
  );
}

// ─── Theme toggle ─────────────────────────────────────────────────────────────
function ThemeSection() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(saved ?? (prefersDark ? 'dark' : 'light'));
  }, []);

  const applyTheme = (t: 'light' | 'dark') => {
    setTheme(t);
    localStorage.setItem('theme', t);
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.style.setProperty('color-scheme', t);
  };

  return (
    <div className="flex items-center gap-3">
      {(['light', 'dark'] as const).map(t => (
        <button
          key={t}
          onClick={() => applyTheme(t)}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
            theme === t
              ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
              : 'bg-[var(--surface)] text-[var(--text)] border-[var(--border)] hover:border-[var(--accent)]'
          }`}
        >
          {t === 'light' ? '☀️ Light' : '🌙 Dark'}
        </button>
      ))}
    </div>
  );
}

// ─── Admin: league branding editor ───────────────────────────────────────────
function LeagueBrandingForm() {
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#3b82f6');
  const [secondaryColor, setSecondaryColor] = useState('#1e40af');
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/settings/branding').then(r => r.json()).then(d => {
      if (d.logoUrl) setLogoUrl(d.logoUrl);
      if (d.primaryColor) setPrimaryColor(d.primaryColor);
      if (d.secondaryColor) setSecondaryColor(d.secondaryColor);
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('saving');
    const res = await fetch('/api/settings/branding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logoUrl: logoUrl.trim(), primaryColor, secondaryColor }),
    });
    if (res.ok) { setStatus('ok'); setMsg('Branding saved'); }
    else { const d = await res.json(); setStatus('error'); setMsg(d?.error || 'Save failed'); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="logo-url">Logo URL</Label>
        <Input id="logo-url" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" />
        <p className="text-xs text-[var(--muted)] mt-1">Enter a URL to your league logo image</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="primary-color">Primary Color</Label>
          <div className="flex items-center gap-2 mt-1">
            <input
              id="primary-color"
              type="color"
              value={primaryColor}
              onChange={e => setPrimaryColor(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border border-[var(--border)]"
            />
            <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="flex-1" placeholder="#3b82f6" />
          </div>
          <div className="mt-2 h-6 rounded" style={{ backgroundColor: primaryColor }} />
        </div>
        <div>
          <Label htmlFor="secondary-color">Secondary Color</Label>
          <div className="flex items-center gap-2 mt-1">
            <input
              id="secondary-color"
              type="color"
              value={secondaryColor}
              onChange={e => setSecondaryColor(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border border-[var(--border)]"
            />
            <Input value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="flex-1" placeholder="#1e40af" />
          </div>
          <div className="mt-2 h-6 rounded" style={{ backgroundColor: secondaryColor }} />
        </div>
      </div>
      {logoUrl && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="Logo preview" className="w-12 h-12 object-contain rounded" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          <p className="text-xs text-[var(--muted)]">Logo preview</p>
        </div>
      )}
      {msg && <p className={`text-sm ${status === 'ok' ? 'text-green-500' : 'text-red-400'}`}>{msg}</p>}
      <Button type="submit" disabled={status === 'saving'}>{status === 'saving' ? 'Saving…' : 'Save Branding'}</Button>
    </form>
  );
}

// ─── Admin: season management ─────────────────────────────────────────────────
type SeasonEntry = { year: string; leagueId: string; isCurrent?: boolean };

function SeasonManagementForm() {
  const [seasons, setSeasons] = useState<SeasonEntry[]>([]);
  const [newYear, setNewYear] = useState('');
  const [newLeagueId, setNewLeagueId] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    fetch('/api/settings/seasons').then(r => r.json()).then(d => {
      if (Array.isArray(d.seasons)) setSeasons(d.seasons);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  const doAction = async (action: string, body: Record<string, string>) => {
    setStatus('saving');
    const res = await fetch('/api/settings/seasons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...body }),
    });
    const d = await res.json();
    if (res.ok) { setStatus('ok'); setMsg('Saved'); reload(); }
    else { setStatus('error'); setMsg(d?.error || 'Failed'); }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newYear.trim() || !newLeagueId.trim()) { setMsg('Both year and league ID are required'); setStatus('error'); return; }
    doAction('add', { year: newYear.trim(), leagueId: newLeagueId.trim() });
    setNewYear('');
    setNewLeagueId('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--muted)]">
          Seasons are auto-discovered from Sleeper when the page loads. Add seasons manually if needed.
        </p>
        <Button size="sm" variant="ghost" onClick={reload} disabled={loading}>
          {loading ? 'Loading…' : '↻ Refresh'}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Discovering seasons from Sleeper…</p>
      ) : seasons.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--muted)] border-b border-[var(--border)]">
                <th className="py-2 pr-3">Year</th>
                <th className="py-2 pr-3">Sleeper League ID</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {seasons.map((s) => (
                <tr key={s.year}>
                  <td className="py-2 pr-3 font-medium text-[var(--text)]">{s.year}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-[var(--muted)] select-all">{s.leagueId}</td>
                  <td className="py-2 pr-3">
                    {s.isCurrent && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--accent)]/15 text-[var(--accent)]">Current</span>
                    )}
                  </td>
                  <td className="py-2 flex gap-2">
                    {!s.isCurrent && (
                      <Button size="sm" variant="ghost" onClick={() => doAction('set-current', { year: s.year })}>
                        Set Current
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => doAction('remove', { year: s.year })}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)] italic">
          No seasons found. Make sure a Sleeper League ID is entered in the setup wizard, or add one manually below.
        </p>
      )}

      <form onSubmit={handleAdd} className="space-y-3 pt-2 border-t border-[var(--border)]">
        <p className="text-sm font-medium text-[var(--text)]">Add Season Manually</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="season-year">Year</Label>
            <Input id="season-year" value={newYear} onChange={e => setNewYear(e.target.value)} placeholder="2024" maxLength={4} />
          </div>
          <div>
            <Label htmlFor="season-lid">Sleeper League ID</Label>
            <Input id="season-lid" value={newLeagueId} onChange={e => setNewLeagueId(e.target.value)} placeholder="1234567890" />
          </div>
        </div>
        {msg && <p className={`text-sm ${status === 'ok' ? 'text-green-500' : 'text-red-400'}`}>{msg}</p>}
        <Button type="submit" disabled={status === 'saving'}>{status === 'saving' ? 'Saving…' : 'Add Season'}</Button>
      </form>
    </div>
  );
}

// ─── Admin: rules editor ──────────────────────────────────────────────────────
function RulesEditorForm() {
  const [rulesContent, setRulesContent] = useState('');
  const [rulesFileUrl, setRulesFileUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/settings/rules').then(r => r.json()).then(d => {
      if (d.rulesContent) setRulesContent(d.rulesContent);
      if (d.rulesFileKey) setRulesFileUrl(d.rulesFileKey);
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('saving');
    const res = await fetch('/api/settings/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rulesContent: rulesContent.trim() || null, rulesFileKey: rulesFileUrl.trim() || null }),
    });
    if (res.ok) { setStatus('ok'); setMsg('Rules saved'); }
    else { const d = await res.json(); setStatus('error'); setMsg(d?.error || 'Save failed'); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="rules-content">Rules Content (HTML)</Label>
        <textarea
          id="rules-content"
          value={rulesContent}
          onChange={e => setRulesContent(e.target.value)}
          rows={10}
          placeholder="Paste HTML rules content here…"
          className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none text-sm font-mono resize-y"
        />
        <p className="text-xs text-[var(--muted)] mt-1">Rich HTML content displayed on the rules page with search support</p>
      </div>
      <div>
        <Label htmlFor="rules-file">Rules PDF URL</Label>
        <Input
          id="rules-file"
          value={rulesFileUrl}
          onChange={e => setRulesFileUrl(e.target.value)}
          placeholder="https://example.com/rules.pdf"
        />
        <p className="text-xs text-[var(--muted)] mt-1">If set, displays the PDF inline. HTML content takes priority when both are set.</p>
      </div>
      {msg && <p className={`text-sm ${status === 'ok' ? 'text-green-500' : 'text-red-400'}`}>{msg}</p>}
      <Button type="submit" disabled={status === 'saving'}>{status === 'saving' ? 'Saving…' : 'Save Rules'}</Button>
    </form>
  );
}

// ─── User: team profile editor ─────────────────────────────────────────────────
function TeamProfileForm({ team }: { team: string }) {
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#3b82f6');
  const [secondaryColor, setSecondaryColor] = useState('#1e40af');
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/settings/team').then(r => r.json()).then(d => {
      if (d.logoUrl) setLogoUrl(d.logoUrl);
      if (d.primaryColor) setPrimaryColor(d.primaryColor);
      if (d.secondaryColor) setSecondaryColor(d.secondaryColor);
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('saving');
    const res = await fetch('/api/settings/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logoUrl: logoUrl.trim() || null, primaryColor, secondaryColor }),
    });
    if (res.ok) { setStatus('ok'); setMsg('Team profile saved'); }
    else { const d = await res.json(); setStatus('error'); setMsg(d?.error || 'Save failed'); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-[var(--muted)]">Customise your team profile for <strong className="text-[var(--text)]">{team}</strong></p>
      <div>
        <Label htmlFor="team-logo-url">Team Logo URL</Label>
        <Input id="team-logo-url" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://example.com/team-logo.png" />
        {logoUrl && (
          <div className="mt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="Logo preview" className="w-12 h-12 object-contain rounded border border-[var(--border)]" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="team-primary-color">Primary Color</Label>
          <div className="flex items-center gap-2 mt-1">
            <input id="team-primary-color" type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border border-[var(--border)]" />
            <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="flex-1" placeholder="#3b82f6" />
          </div>
        </div>
        <div>
          <Label htmlFor="team-secondary-color">Secondary Color</Label>
          <div className="flex items-center gap-2 mt-1">
            <input id="team-secondary-color" type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border border-[var(--border)]" />
            <Input value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="flex-1" placeholder="#1e40af" />
          </div>
        </div>
      </div>
      {msg && <p className={`text-sm ${status === 'ok' ? 'text-green-500' : 'text-red-400'}`}>{msg}</p>}
      <Button type="submit" disabled={status === 'saving'}>{status === 'saving' ? 'Saving…' : 'Save Team Profile'}</Button>
    </form>
  );
}

// ─── Admin: Discord webhooks ─────────────────────────────────────────────────
function DiscordWebhooksForm() {
  const [suggestions, setSuggestions] = useState('');
  const [trades, setTrades] = useState('');
  const [tradeBlock, setTradeBlock] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/settings/discord').then(r => r.json()).then(d => {
      setSuggestions(d.suggestions ?? '');
      setTrades(d.trades ?? '');
      setTradeBlock(d.tradeBlock ?? '');
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('saving');
    const res = await fetch('/api/settings/discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        suggestions: suggestions.trim() || null,
        trades: trades.trim() || null,
        tradeBlock: tradeBlock.trim() || null,
      }),
    });
    if (res.ok) { setStatus('ok'); setMsg('Webhooks saved'); }
    else { const d = await res.json(); setStatus('error'); setMsg(d?.error || 'Save failed'); }
  };

  const webhookField = (label: string, hint: string, value: string, setter: (v: string) => void) => (
    <div>
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={e => setter(e.target.value)}
        placeholder="https://discord.com/api/webhooks/..."
      />
      <p className="text-xs text-[var(--muted)] mt-1">{hint}</p>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-[var(--muted)]">Paste Discord webhook URLs to enable notifications. Leave blank to disable a channel. These override any server environment variables.</p>
      {webhookField('Suggestions Webhook', 'Posted when a league member submits a new suggestion.', suggestions, setSuggestions)}
      {webhookField('Trades Webhook', 'Posted when a trade is completed or pending (via cron notifier).', trades, setTrades)}
      {webhookField('Trade Block Webhook', 'Posted when a team updates their trade block (Clancy reporter).', tradeBlock, setTradeBlock)}
      {msg && <p className={`text-sm ${status === 'ok' ? 'text-green-500' : 'text-red-400'}`}>{msg}</p>}
      <Button type="submit" disabled={status === 'saving'}>{status === 'saving' ? 'Saving…' : 'Save Webhooks'}</Button>
    </form>
  );
}

// ─── Main settings page ───────────────────────────────────────────────────────
export default function SettingsContent() {
  const router = useRouter();
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [leagueInfo, setLeagueInfo] = useState<LeagueInfo>({ name: null, shortName: null });

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(setAuth).catch(() => setAuth({ authenticated: false, isAdmin: false }));
    fetch('/api/league/info').then(r => r.json()).then(d => setLeagueInfo({ name: d.name, shortName: d.shortName })).catch(() => {});
  }, []);

  if (!auth) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-[var(--muted)] text-sm">Loading…</div>
      </div>
    );
  }

  const team = auth.claims?.team as string | undefined;
  const isLoggedIn = auth.authenticated && !!team;
  const isAdmin = auth.isAdmin;

  if (!isLoggedIn && !isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <SectionHeader title="Settings" />
        <Card className="mt-6">
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-[var(--muted)]">Sign in to access your settings.</p>
            <Button onClick={() => router.push('/login')}>Sign In</Button>
          </CardContent>
        </Card>

        {/* Theme is available to anyone */}
        <Card className="mt-6">
          <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
          <CardContent><ThemeSection /></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
      <SectionHeader
        title="Settings"
        subtitle={isAdmin ? 'Commish & account settings' : `Signed in as ${team}`}
      />

      {/* ── Appearance (everyone) ── */}
      <Card>
        <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
        <CardContent><ThemeSection /></CardContent>
      </Card>

      {/* ── User account ── */}
      {isLoggedIn && (
        <Card>
          <CardHeader><CardTitle>Account</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-sm text-[var(--muted)] mb-1">Signed in as</p>
              <p className="font-semibold text-[var(--text)]">{team}</p>
            </div>
            <hr className="border-[var(--border)]" />
            <div>
              <h3 className="font-medium text-[var(--text)] mb-3">Change PIN</h3>
              <ChangePinForm team={team!} />
            </div>
            <hr className="border-[var(--border)]" />
            <div>
              <h3 className="font-medium text-[var(--text)] mb-3">Team Profile</h3>
              <TeamProfileForm team={team!} />
            </div>
            <hr className="border-[var(--border)]" />
            <Button
              variant="ghost"
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                router.push('/');
                router.refresh();
              }}
            >
              Sign Out
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Admin settings ── */}
      {isAdmin && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>League Info</CardTitle>
            </CardHeader>
            <CardContent>
              <LeagueInfoForm initial={leagueInfo} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Commissioner</CardTitle>
            </CardHeader>
            <CardContent>
              <CommissionerAssignmentForm />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Important Dates</CardTitle>
            </CardHeader>
            <CardContent>
              <ImportantDatesForm />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Projected Draft Order</CardTitle>
            </CardHeader>
            <CardContent>
              <ProjectedDraftOrderForm />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Join Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <JoinRequestsPanel />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>League Branding</CardTitle></CardHeader>
            <CardContent>
              <LeagueBrandingForm />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Season Management</CardTitle></CardHeader>
            <CardContent>
              <SeasonManagementForm />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Rules</CardTitle></CardHeader>
            <CardContent>
              <RulesEditorForm />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Discord Webhooks</CardTitle></CardHeader>
            <CardContent>
              <DiscordWebhooksForm />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Admin Tools</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-3">
                <Button variant="ghost" onClick={() => router.push('/admin')}>
                  Admin Dashboard
                </Button>
                <Button variant="ghost" onClick={() => router.push('/admin/trades')}>
                  Manage Trades
                </Button>
                <Button variant="ghost" onClick={() => router.push('/admin/draft')}>
                  Manage Draft
                </Button>
              </div>
              <p className="text-xs text-[var(--muted)]">Full admin tools are available in the admin dashboard.</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
