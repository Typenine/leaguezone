'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

type LeagueSearchMatch = {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  foundedYear: number | null;
  matchedSeason: string | null;
  openRosters: number;
};

export default function LeagueWebsiteSearch() {
  const [sleeperLeagueId, setSleeperLeagueId] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [match, setMatch] = useState<LeagueSearchMatch | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestName, setRequestName] = useState('');
  const [requestEmail, setRequestEmail] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [requestStatus, setRequestStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [requestMsg, setRequestMsg] = useState('');

  const search = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMatch(null);
    setSearched(false);
    setRequestOpen(false);
    setRequestStatus('idle');
    setRequestMsg('');

    try {
      const res = await fetch(`/api/league/search?sleeperLeagueId=${encodeURIComponent(sleeperLeagueId.trim())}`, { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Search failed');
      setMatch(body.match || null);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const submitRequest = async (event: FormEvent) => {
    event.preventDefault();
    if (!match) return;
    setRequestStatus('saving');
    setRequestMsg('');

    try {
      const res = await fetch('/api/league/join-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId: match.id,
          sleeperLeagueId: sleeperLeagueId.trim(),
          name: requestName,
          email: requestEmail,
          message: requestMessage,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Failed to submit request');
      setRequestStatus('ok');
      setRequestMsg('Request sent. The commissioner can review it in league settings.');
      setRequestName('');
      setRequestEmail('');
      setRequestMessage('');
    } catch (err) {
      setRequestStatus('error');
      setRequestMsg(err instanceof Error ? err.message : 'Failed to submit request');
    }
  };

  const goToInvite = () => {
    const code = inviteCode.trim();
    if (code) window.location.href = `/join/${encodeURIComponent(code)}`;
  };

  return (
    <div className="league-card p-6 sm:p-8">
      <div className="mb-5">
        <p className="eyebrow">Find your league website</p>
        <h2 className="mt-3 text-2xl font-black text-[var(--text)]">Search by Sleeper league ID</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Enter any Sleeper league ID from a current or past season to see whether this site already hosts that league.
        </p>
      </div>

      <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={sleeperLeagueId}
          onChange={(event) => setSleeperLeagueId(event.target.value)}
          placeholder="Sleeper league ID"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label="Sleeper league ID"
        />
        <Button type="submit" disabled={loading || !sleeperLeagueId.trim()} className="shrink-0">
          {loading ? 'Searching...' : 'Search'}
        </Button>
      </form>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {searched && !match && !error && (
        <div className="mt-5 rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">
          No league website was found for that Sleeper ID.
        </div>
      )}

      {match && (
        <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)]"
                style={{ background: `color-mix(in srgb, ${match.primaryColor || 'var(--accent)'} 18%, transparent)` }}
              >
                {match.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={match.logoUrl} alt={match.name} className="h-full w-full object-contain" />
                ) : (
                  <span className="font-black text-[var(--text)]">{match.name.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="truncate font-bold text-[var(--text)]">{match.name}</h3>
                <p className="text-sm text-[var(--muted)]">
                  {match.matchedSeason ? `Matched ${match.matchedSeason} Sleeper ID` : 'Matched current Sleeper ID'}
                  {match.openRosters > 0 ? ` • ${match.openRosters} open roster${match.openRosters === 1 ? '' : 's'}` : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/l/${match.slug}`} className="btn btn-secondary text-sm px-3 py-1.5">
                View homepage
              </Link>
              <Button type="button" size="sm" onClick={() => setRequestOpen((open) => !open)}>
                Request to join
              </Button>
            </div>
          </div>

          {requestOpen && (
            <form onSubmit={submitRequest} className="mt-4 grid gap-3 border-t border-[var(--border)] pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input value={requestName} onChange={(event) => setRequestName(event.target.value)} placeholder="Your name" required />
                <Input value={requestEmail} onChange={(event) => setRequestEmail(event.target.value)} placeholder="Email" type="email" required />
              </div>
              <Input value={requestMessage} onChange={(event) => setRequestMessage(event.target.value)} placeholder="Optional note to the commissioner" maxLength={300} />
              {requestMsg && (
                <p className={`text-sm ${requestStatus === 'ok' ? 'text-green-500' : 'text-red-400'}`}>{requestMsg}</p>
              )}
              <Button type="submit" disabled={requestStatus === 'saving'}>
                {requestStatus === 'saving' ? 'Sending...' : 'Send request'}
              </Button>
            </form>
          )}
        </div>
      )}

      <div className="mt-5 border-t border-[var(--border)] pt-5">
        <label htmlFor="invite-code" className="text-sm font-semibold text-[var(--text)]">Have an invite code?</label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Input
            id="invite-code"
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value)}
            placeholder="Enter invite code"
          />
          <Button type="button" variant="secondary" onClick={goToInvite} disabled={!inviteCode.trim()} className="shrink-0">
            Join with code
          </Button>
        </div>
      </div>
    </div>
  );
}
