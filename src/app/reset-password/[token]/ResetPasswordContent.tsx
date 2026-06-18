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

  const inputCls = "w-full border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2.5 text-[var(--text)] focus:outline-none focus:border-[var(--brand-gold)]/60 focus:ring-1 focus:ring-[var(--brand-gold)]/30 transition-colors";
  const labelCls = "mb-2 block text-[10px] font-black uppercase tracking-[0.25em] text-[var(--brand-gold)]";

  return (
    <div style={{ background: 'var(--brand-ink)' }} className="min-h-screen flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link href="/" aria-label="Website home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/LeagueZone HQ Logo.png"
              alt="LeagueZone HQ"
              className="w-20 h-20 object-contain"
            />
          </Link>
        </div>

        <div className="flex items-center justify-center gap-3 mb-3">
          <span className="block w-6 h-px bg-[var(--brand-gold)]" />
          <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--brand-gold)]">Set New Password</span>
          <span className="block w-6 h-px bg-[var(--brand-gold)]" />
        </div>
        <h1 className="text-3xl font-black text-center text-white uppercase tracking-tight mb-2">Set new password</h1>
        <p className="text-center text-sm text-white/45 mb-8">
          Choose a new password for your account.
        </p>

        <Card>
          <CardContent className="pt-6 space-y-5">
            {done ? (
              <div className="text-center space-y-3 py-4">
                <div className="text-4xl">✅</div>
                <p className="font-black text-white uppercase tracking-wide text-sm">Password updated!</p>
                <p className="text-sm text-white/50">Redirecting you to your league…</p>
              </div>
            ) : (
              <>
                <div>
                  <Label htmlFor="password" className={labelCls}>New password</Label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    autoFocus
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    className={inputCls}
                  />
                </div>

                <div>
                  <Label htmlFor="confirmPassword" className={labelCls}>Confirm new password</Label>
                  <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    className={inputCls}
                  />
                </div>

                {error && <div className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 px-3 py-2" role="alert">{error}</div>}

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
    </div>
  );
}
