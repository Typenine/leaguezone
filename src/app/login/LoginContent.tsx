'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import Label from '@/components/ui/Label';
import Button from '@/components/ui/Button';

export default function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams?.get('next') || '/home';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Login failed');
      router.push(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

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
          <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--brand-gold)]">Sign In</span>
          <span className="block w-6 h-px bg-[var(--brand-gold)]" />
        </div>
        <h1 className="text-3xl font-black text-center text-white uppercase tracking-tight mb-2">Welcome back</h1>
        <p className="text-center text-sm text-white/45 mb-8">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-[var(--brand-gold)] hover:underline font-bold">
            Create one
          </Link>
        </p>

        <Card>
          <CardContent className="pt-6 space-y-5">
            <div>
              <Label htmlFor="email" className="mb-2 block text-[10px] font-black uppercase tracking-[0.25em] text-[var(--brand-gold)]">Email</Label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2.5 text-[var(--text)] focus:outline-none focus:border-[var(--brand-gold)]/60 focus:ring-1 focus:ring-[var(--brand-gold)]/30 transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--brand-gold)]">Password</Label>
                <Link href="/forgot-password" className="text-xs text-white/35 hover:text-[var(--brand-gold)] transition-colors">
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2.5 text-[var(--text)] focus:outline-none focus:border-[var(--brand-gold)]/60 focus:ring-1 focus:ring-[var(--brand-gold)]/30 transition-colors"
              />
            </div>

            {error && (
              <div className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 px-3 py-2" role="alert">{error}</div>
            )}

            <Button
              onClick={handleLogin}
              disabled={!email || !password || loading}
              variant="primary"
              className="w-full"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-white/25 mt-6">
          Site admin?{' '}
          <Link href="/super-admin/login" className="text-amber-400 hover:underline font-bold">
            Admin Mode →
          </Link>
        </p>
      </div>
    </div>
  );
}
