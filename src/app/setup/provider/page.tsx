'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

type YahooStatus = {
  configured: boolean;
  enabled: boolean;
  available: boolean;
  connected: boolean;
};

type YahooLeague = {
  providerLeagueId: string;
  providerGameId: string | null;
  name: string;
  season: number;
  numTeams: number | null;
  logoUrl: string | null;
  isFinished: boolean;
};

export default function SetupProviderPage() {
  const router = useRouter();
  const [yahooStatus, setYahooStatus] = useState<YahooStatus | null>(null);
  const [yahooLeagues, setYahooLeagues] = useState<YahooLeague[]>([]);
  const [selectedLeague, setSelectedLeague] = useState('');
  const [loadingYahoo, setLoadingYahoo] = useState(false);
  const [importingYahoo, setImportingYahoo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadYahooLeagues = useCallback(async () => {
    setLoadingYahoo(true);
    setError(null);
    try {
      const res = await fetch('/api/providers/yahoo/leagues', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not load Yahoo leagues.');
      const leagues = Array.isArray(data.leagues) ? data.leagues as YahooLeague[] : [];
      setYahooLeagues(leagues);
      if (leagues.length === 1) setSelectedLeague(leagues[0].providerLeagueId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Yahoo leagues.');
    } finally {
      setLoadingYahoo(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadStatus() {
      try {
        const res = await fetch('/api/providers/yahoo/status', { cache: 'no-store' });
        if (!res.ok) return;
        const status = await res.json() as YahooStatus;
        if (cancelled) return;
        setYahooStatus(status);
        if (status.available && status.connected) await loadYahooLeagues();
      } catch {
        // Sleeper setup remains available even if Yahoo status cannot load.
      }
    }

    const params = new URLSearchParams(window.location.search);
    const yahooError = params.get('yahooError');
    if (yahooError) {
      const messages: Record<string, string> = {
        denied: 'Yahoo authorization was cancelled.',
        state: 'Yahoo authorization expired. Please try connecting again.',
        exchange: 'Yahoo could not be connected. Please try again.',
        league: 'Your league setup session changed during Yahoo authorization. Please try again.',
        session: 'Your LeagueZone session expired. Sign in and try again.',
        unavailable: 'Yahoo Fantasy integration is not currently enabled.',
      };
      setError(messages[yahooError] || 'Yahoo could not be connected.');
    }

    loadStatus();
    return () => { cancelled = true; };
  }, [loadYahooLeagues]);

  const connectYahoo = () => {
    window.location.assign('/api/providers/yahoo/start');
  };

  const importYahooLeague = async () => {
    if (!selectedLeague) {
      setError('Choose a Yahoo league to import.');
      return;
    }

    setImportingYahoo(true);
    setError(null);
    try {
      const res = await fetch('/api/setup/yahoo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerLeagueId: selectedLeague }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to import Yahoo league.');
      router.push('/setup/branding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import Yahoo league.');
    } finally {
      setImportingYahoo(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.push('/setup')}
            className="text-[var(--muted)] hover:text-[var(--text)] flex items-center gap-1 text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to overview
          </button>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--accent)] text-[var(--on-accent,#ffffff)] text-lg font-bold mb-4">
            2
          </div>
          <h1 className="text-2xl font-bold text-[var(--text)] mb-2">Connect Your Fantasy League</h1>
          <p className="text-[var(--muted)]">Choose the provider that currently hosts your league.</p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <Card className="p-6 h-full">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-1">Provider</div>
                <h2 className="text-xl font-bold text-[var(--text)]">Sleeper</h2>
              </div>
              <span className="text-xs rounded-full px-2.5 py-1 bg-green-500/10 text-green-400 border border-green-500/20">Available</span>
            </div>
            <p className="text-sm text-[var(--muted)] mb-6">
              Import your current Sleeper league and automatically discover linked historical seasons.
            </p>
            <Button onClick={() => router.push('/setup/sleeper')} className="w-full">
              Connect Sleeper
            </Button>
          </Card>

          <Card className="p-6 h-full">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mb-1">Provider</div>
                <h2 className="text-xl font-bold text-[var(--text)]">Yahoo Fantasy</h2>
              </div>
              {yahooStatus?.available ? (
                <span className="text-xs rounded-full px-2.5 py-1 bg-green-500/10 text-green-400 border border-green-500/20">Beta</span>
              ) : (
                <span className="text-xs rounded-full px-2.5 py-1 bg-[var(--surface-strong)] text-[var(--muted)] border border-[var(--border)]">Not enabled</span>
              )}
            </div>

            {!yahooStatus ? (
              <p className="text-sm text-[var(--muted)]">Checking Yahoo availability…</p>
            ) : !yahooStatus.available ? (
              <p className="text-sm text-[var(--muted)]">
                Yahoo support is built behind a release flag and stays unavailable until LeagueZone has approved Yahoo Fantasy API credentials configured on this deployment.
              </p>
            ) : !yahooStatus.connected ? (
              <>
                <p className="text-sm text-[var(--muted)] mb-6">
                  Connect Yahoo securely, then choose one of the football leagues available to your Yahoo account. LeagueZone never receives your Yahoo password.
                </p>
                <Button onClick={connectYahoo} className="w-full">Connect Yahoo</Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-green-400">Yahoo connected</p>
                  <button
                    type="button"
                    onClick={loadYahooLeagues}
                    disabled={loadingYahoo}
                    className="text-xs text-[var(--accent)] hover:underline disabled:opacity-50"
                  >
                    {loadingYahoo ? 'Refreshing…' : 'Refresh leagues'}
                  </button>
                </div>

                {loadingYahoo ? (
                  <p className="text-sm text-[var(--muted)]">Loading your Yahoo football leagues…</p>
                ) : yahooLeagues.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">No Yahoo fantasy football leagues were returned for this account.</p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {yahooLeagues.map((league) => {
                      const selected = selectedLeague === league.providerLeagueId;
                      return (
                        <button
                          type="button"
                          key={league.providerLeagueId}
                          onClick={() => setSelectedLeague(league.providerLeagueId)}
                          className={`w-full text-left rounded-lg border p-3 transition-colors ${selected ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--border)] hover:border-[var(--accent)]/50'}`}
                        >
                          <div className="font-medium text-[var(--text)] truncate">{league.name}</div>
                          <div className="text-xs text-[var(--muted)] mt-1">
                            {league.season}{league.numTeams ? ` · ${league.numTeams} teams` : ''}{league.isFinished ? ' · Completed' : ''}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <Button
                  onClick={importYahooLeague}
                  disabled={!selectedLeague || importingYahoo || loadingYahoo}
                  className="w-full"
                >
                  {importingYahoo ? 'Importing…' : 'Import Selected Yahoo League'}
                </Button>
              </div>
            )}
          </Card>
        </div>

        <p className="text-center text-xs text-[var(--muted)] mt-6">
          Provider credentials stay server-side. LeagueZone stores the connection only so it can refresh league data later.
        </p>
      </div>
    </div>
  );
}
