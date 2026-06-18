'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import Label from '@/components/ui/Label';
import Button from '@/components/ui/Button';

export default function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = searchParams?.get('invite') || '';

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    try {
      setLoading(true);
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, displayName, password, confirmPassword, inviteCode: inviteCode || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Registration failed');
      // If we came from an invite link, go there to claim the roster
      if (inviteCode) {
        router.push(`/join/${inviteCode}`);
      } else {
        // New users without invite go to /app with welcome banner
        router.push('/app?welcome=true');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2.5 text-[var(--text)] focus:outline-none focus:border-[var(--brand-gold)]/60 focus:ring-1 focus:ring-[var(--brand-gold)]/30 transition-colors";
  const labelCls = "mb-2 block text-[10px] font-black uppercase tracking-[0.25em] text-[var(--brand-gold)]";

  return (
    <div style={{ background: 'var(--brand-ink)' }} className="min-h-screen flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
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
          <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--brand-gold)]">Create Account</span>
          <span className="block w-6 h-px bg-[var(--brand-gold)]" />
        </div>
        <h1 className="text-3xl font-black text-center text-white uppercase tracking-tight mb-2">Join the league</h1>
        <p className="text-center text-sm text-white/45 mb-8">
          Already have one?{' '}
          <Link href="/login" className="text-[var(--brand-gold)] hover:underline font-bold">
            Sign in
          </Link>
        </p>

        <Card>
          <CardContent className="pt-6 space-y-5">
            <div>
              <Label htmlFor="email" className={labelCls}>Email</Label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className={inputCls}
              />
            </div>

            <div>
              <Label htmlFor="displayName" className={labelCls}>Display name</Label>
              <input
                id="displayName"
                type="text"
                autoComplete="name"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className={inputCls}
              />
            </div>

            <div>
              <Label htmlFor="password" className={labelCls}>Password</Label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className={inputCls}
              />
            </div>

            <div>
              <Label htmlFor="confirmPassword" className={labelCls}>Confirm password</Label>
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

            {error && (
              <div className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 px-3 py-2" role="alert">{error}</div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={!email || !displayName || !password || !confirmPassword || loading}
              variant="primary"
              className="w-full"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
