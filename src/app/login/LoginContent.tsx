'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { TEAM_NAMES } from '@/lib/constants/league';
import { getTeamLogoPath, getTeamColorStyle, getTeamColors } from '@/lib/utils/team-utils';
import { Card, CardContent } from '@/components/ui/Card';
import Label from '@/components/ui/Label';
import Button from '@/components/ui/Button';
import { useRouter, useSearchParams } from 'next/navigation';

export const dynamic = 'force-dynamic';

type Tab = 'team' | 'commish';

function LoginContent() {
  const search = useSearchParams();
  const router = useRouter();
  const initialTab: Tab = search?.get('mode') === 'commish' ? 'commish' : 'team';
  const preselectedTeam = search?.get('team') || null;

  const [tab, setTab] = useState<Tab>(initialTab);

  // Team login state
  const [selectedTeam, setSelectedTeam] = useState<string | null>(preselectedTeam);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Commish login state
  const [commishPin, setCommishPin] = useState('');
  const [commishLoading, setCommishLoading] = useState(false);
  const [commishError, setCommishError] = useState<string | null>(null);
  const commishRef = useRef<HTMLInputElement | null>(null);

  // Auto-focus commish input when tab opens
  useEffect(() => {
    if (tab === 'commish') {
      setTimeout(() => commishRef.current?.focus(), 50);
    }
  }, [tab]);

  const handleTeamLogin = async () => {
    if (!selectedTeam || !pin) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ team: selectedTeam, pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Login failed');
      const next = search?.get('next') || '/home';
      router.push(next);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCommishLogin = async () => {
    if (!commishPin) return;
    try {
      setCommishLoading(true);
      setCommishError(null);
      const r = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: commishPin.trim() }),
      });
      if (!r.ok) throw new Error('Invalid PIN');
      setCommishPin('');
      router.push('/home');
    } catch (e) {
      setCommishError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setCommishLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      {/* Logo */}
      <div className="flex justify-center mb-6">
        <Link href="/" aria-label="Website home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/teams/East v West Logos/EvW Clancy logo.png"
            alt="League logo"
            className="w-20 h-20 object-contain"
          />
        </Link>
      </div>

      {/* Tab switcher */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex rounded-xl border border-[var(--border)] overflow-hidden">
          {(['team', 'commish'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-6 py-2.5 text-sm font-medium transition-colors ${
                tab === t
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              {t === 'team' ? '🏈 Team Login' : '🏆 Commish Login'}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {/* â”€â”€ Team Login â”€â”€ */}
          {tab === 'team' && (
            <div className="space-y-6">
              <div>
                <Label className="mb-2 block">Select Your Team</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {TEAM_NAMES.map((team) => {
                    const active = selectedTeam === team;
                    const style = getTeamColorStyle(team, 'secondary');
                    return (
                      <button
                        key={team}
                        type="button"
                        onClick={() => setSelectedTeam(team)}
                        className={`rounded-lg border transition hover-lift focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)] ${active ? 'border-2' : ''}`}
                        aria-pressed={active}
                        style={active ? { borderColor: getTeamColors(team).secondary } : undefined}
                      >
                        <div className="p-3 flex flex-col items-center justify-center gap-2">
                          <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center" style={style}>
                            <Image src={getTeamLogoPath(team)} alt={team} width={36} height={36} className="object-contain" />
                          </div>
                          <div className="text-xs text-center line-clamp-2">{team}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label htmlFor="pin" className="mb-2 block">PIN</Label>
                <input
                  id="pin"
                  name="pin"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="off"
                  pattern="[0-9]*"
                  maxLength={12}
                  placeholder="Enter your PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 12))}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)]"
                />
              </div>

              {error && <div className="text-sm text-red-500" role="alert">{error}</div>}

              <div className="flex items-center gap-3">
                <Button onClick={handleTeamLogin} disabled={!selectedTeam || !pin || loading} variant="primary">
                  {loading ? 'Signing in…' : 'Sign In'}
                </Button>
                <Button onClick={() => { setSelectedTeam(null); setPin(''); setError(null); }} variant="ghost">
                  Reset
                </Button>
              </div>
            </div>
          )}

          {/* â”€â”€ Commish Login â”€â”€ */}
          {tab === 'commish' && (
            <div className="max-w-sm mx-auto space-y-4 py-4">
              <p className="text-sm text-[var(--muted)] text-center">
                Enter your commissioner PIN to enter Commish Mode.
              </p>
              <div>
                <Label htmlFor="commish-pin" className="mb-1 block">Commish PIN</Label>
                <input
                  ref={commishRef}
                  id="commish-pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)]"
                  value={commishPin}
                  onChange={(e) => setCommishPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 12))}
                  placeholder="Enter commish PIN"
                  onKeyDown={(e) => e.key === 'Enter' && handleCommishLogin()}
                />
              </div>
              {commishError && <div className="text-sm text-red-500" role="alert">{commishError}</div>}
              <Button
                onClick={handleCommishLogin}
                disabled={!commishPin || commishLoading}
                className="w-full"
              >
                {commishLoading ? 'Verifying…' : 'Enter Commish Mode'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin Mode link */}
      <p className="text-center text-xs text-[var(--muted)] mt-6">
        Site admin?{' '}
        <Link href="/super-admin/login" className="text-amber-500 hover:underline font-medium">
          Enter Admin Mode →
        </Link>
      </p>
    </div>
  );
}

export default LoginContent;


