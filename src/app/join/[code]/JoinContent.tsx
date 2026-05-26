'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getTeamLogoPath, getTeamColorStyle } from '@/lib/utils/team-utils';
import { Card, CardContent } from '@/components/ui/Card';
import Label from '@/components/ui/Label';
import Button from '@/components/ui/Button';

interface JoinContentProps {
  code: string;
  teamName: string;
  claimed: boolean;
  leagueName: string | null;
  primaryColor: string | null;
  logoUrl: string | null;
}

export default function JoinContent({
  code,
  teamName,
  claimed,
  leagueName,
  primaryColor,
}: JoinContentProps) {
  const router = useRouter();
  const accent = primaryColor || 'var(--accent)';
  const logoStyle = getTeamColorStyle(teamName, 'secondary');

  // PIN creation state
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Login state (for already-claimed users)
  const [loginPin, setLoginPin] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleSetupPin = async () => {
    if (!pin) return;
    if (pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }
    if (!/^\d{4,12}$/.test(pin)) {
      setError('PIN must be 4–12 digits');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/auth/setup-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: code, pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Setup failed');
      router.push('/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!loginPin) return;
    try {
      setLoginLoading(true);
      setLoginError(null);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ team: teamName, pin: loginPin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Login failed');
      router.push('/home');
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-lg">
      {/* Logo */}
      <div className="flex justify-center mb-6">
        <Link href="/" aria-label="Website home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/teams/East v West Logos/EvW Clancy logo.png"
            alt="League logo"
            className="w-16 h-16 object-contain"
          />
        </Link>
      </div>

      {leagueName && (
        <p className="text-center text-sm text-[var(--muted)] mb-2">{leagueName}</p>
      )}

      {/* Team hero */}
      <div className="flex flex-col items-center mb-8">
        <div
          className="w-24 h-24 rounded-full overflow-hidden border-4 flex items-center justify-center mb-4 shadow-lg"
          style={{ ...logoStyle, borderColor: accent }}
        >
          <Image
            src={getTeamLogoPath(teamName)}
            alt={teamName}
            width={80}
            height={80}
            className="object-contain"
          />
        </div>
        <h1 className="text-2xl font-bold text-[var(--text)] text-center">{teamName}</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          {claimed ? 'Welcome back! Sign in below.' : "You've been invited to join the league."}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {!claimed ? (
            /* ── First-time setup ── */
            <div className="space-y-5">
              <div className="p-4 rounded-xl text-sm" style={{ backgroundColor: `${accent}15`, color: 'var(--text)' }}>
                <strong>Create your PIN</strong> to secure your account. You&apos;ll use this every time you sign in.
              </div>

              <div>
                <Label htmlFor="new-pin" className="mb-2 block">Choose a PIN (4–12 digits)</Label>
                <input
                  id="new-pin"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="off"
                  pattern="[0-9]*"
                  maxLength={12}
                  placeholder="e.g. 4567"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 12))}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)]"
                  onKeyDown={(e) => e.key === 'Enter' && handleSetupPin()}
                />
              </div>

              <div>
                <Label htmlFor="confirm-pin" className="mb-2 block">Confirm PIN</Label>
                <input
                  id="confirm-pin"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="off"
                  pattern="[0-9]*"
                  maxLength={12}
                  placeholder="Repeat your PIN"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 12))}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)]"
                  onKeyDown={(e) => e.key === 'Enter' && handleSetupPin()}
                />
              </div>

              {error && <div className="text-sm text-red-500" role="alert">{error}</div>}

              <Button
                onClick={handleSetupPin}
                disabled={!pin || !confirmPin || loading}
                variant="primary"
                className="w-full"
              >
                {loading ? 'Setting up…' : 'Create PIN & Enter League'}
              </Button>
            </div>
          ) : (
            /* ── Already claimed — sign in ── */
            <div className="space-y-5">
              <div className="p-4 rounded-xl text-sm" style={{ backgroundColor: `${accent}15`, color: 'var(--text)' }}>
                Your account is already set up. Enter your PIN to sign in.
              </div>

              <div>
                <Label htmlFor="login-pin" className="mb-2 block">Your PIN</Label>
                <input
                  id="login-pin"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="off"
                  pattern="[0-9]*"
                  maxLength={12}
                  autoFocus
                  placeholder="Enter your PIN"
                  value={loginPin}
                  onChange={(e) => setLoginPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 12))}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)]"
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>

              {loginError && <div className="text-sm text-red-500" role="alert">{loginError}</div>}

              <Button
                onClick={handleLogin}
                disabled={!loginPin || loginLoading}
                variant="primary"
                className="w-full"
              >
                {loginLoading ? 'Signing in…' : 'Sign In'}
              </Button>

              <p className="text-center text-xs text-[var(--muted)]">
                Forgot your PIN?{' '}
                <Link href="/login" className="text-[var(--accent)] hover:underline">
                  Go to login page
                </Link>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
