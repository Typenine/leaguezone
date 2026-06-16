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
    <div className="container mx-auto px-4 py-10 max-w-md">
      {/* Logo */}
      <div className="flex justify-center mb-6">
        <Link href="/" aria-label="Website home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/LeagueZone HQ Logo.png"
            alt="LeagueZone HQ"
            className="w-16 h-16 object-contain rounded-xl"
          />
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-center text-[var(--text)] mb-2">Sign in</h1>
      <p className="text-center text-sm text-[var(--muted)] mb-6">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-[var(--accent)] hover:underline">
          Create one
        </Link>
      </p>

      <Card>
        <CardContent className="pt-6 space-y-5">
          <div>
            <Label htmlFor="email" className="mb-2 block">Email</Label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-xs text-[var(--muted)] hover:text-[var(--accent)]">
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
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)]"
            />
          </div>

          {error && (
            <div className="text-sm text-red-500" role="alert">{error}</div>
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

      {/* Site admin link */}
      <p className="text-center text-xs text-[var(--muted)] mt-6">
        Site admin?{' '}
        <Link href="/super-admin/login" className="text-amber-500 hover:underline font-medium">
          Admin Mode →
        </Link>
      </p>
    </div>
  );
}
