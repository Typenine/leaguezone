'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import Label from '@/components/ui/Label';
import Button from '@/components/ui/Button';

export default function ResetPasswordContent({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!password || !confirmPassword) return;
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Reset failed');
      setDone(true);
      setTimeout(() => router.push('/home'), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-md">
      <div className="flex justify-center mb-6">
        <Link href="/" aria-label="Website home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/LeagueZone HQ Logo.png"
            alt="LeagueZone HQ"
            className="w-32 h-32 object-contain rounded-2xl"
          />
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-center text-[var(--text)] mb-2">Set new password</h1>
      <p className="text-center text-sm text-[var(--muted)] mb-6">
        Choose a new password for your account.
      </p>

      <Card>
        <CardContent className="pt-6 space-y-5">
          {done ? (
            <div className="text-center space-y-3 py-4">
              <div className="text-4xl">✅</div>
              <p className="font-medium text-[var(--text)]">Password updated!</p>
              <p className="text-sm text-[var(--muted)]">Redirecting you to your league…</p>
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="password" className="mb-2 block">New password</Label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  autoFocus
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)]"
                />
              </div>

              <div>
                <Label htmlFor="confirmPassword" className="mb-2 block">Confirm new password</Label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)]"
                />
              </div>

              {error && <div className="text-sm text-red-500" role="alert">{error}</div>}

              <Button
                onClick={handleSubmit}
                disabled={!password || !confirmPassword || loading}
                variant="primary"
                className="w-full"
              >
                {loading ? 'Updating…' : 'Update password'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
