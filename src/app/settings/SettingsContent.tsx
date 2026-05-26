'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SectionHeader from '@/components/ui/SectionHeader';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';

type AuthState = {
  authenticated: boolean;
  isAdmin: boolean;
  claims?: { team?: string; [k: string]: unknown };
};

type LeagueInfo = {
  name: string | null;
  shortName: string | null;
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
        subtitle={isAdmin ? 'Admin & account settings' : `Signed in as ${team}`}
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
              <CardTitle>Important Dates</CardTitle>
            </CardHeader>
            <CardContent>
              <ImportantDatesForm />
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
