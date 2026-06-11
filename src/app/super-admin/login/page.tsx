'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function SuperAdminLoginPage() {
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams?.get('next') || '/newsletter';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const trimmed = key.trim();
      let ok = false;

      const superRes = await fetch('/api/super-admin-login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key: trimmed }),
      });
      if (superRes.ok) {
        ok = true;
      } else {
        // Fall back to league admin PIN (EVW_ADMIN_SECRET, default 002023)
        const leagueRes = await fetch('/api/admin-login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ key: trimmed }),
        });
        if (leagueRes.ok) {
          ok = true;
        } else {
          const j = await leagueRes.json().catch(() => ({}));
          throw new Error(j?.error || 'Invalid admin key');
        }
      }

      if (ok) {
        router.push(nextPath);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm">
          <div className="text-center mb-6">
            <div className="text-4xl mb-3">🌐</div>
            <h1 className="text-xl font-bold text-[var(--text)]">Admin Mode Login</h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              Enter your league admin PIN or site admin key to manage newsletters, settings, and more.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="super-admin-key"
                className="block text-sm font-medium text-[var(--text)] mb-1"
              >
                Admin Key
              </label>
              <input
                id="super-admin-key"
                type="password"
                autoComplete="current-password"
                autoFocus
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-strong,var(--surface))] px-3 py-2 text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
                placeholder="League admin PIN"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !key}
              className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>

            <p className="text-center text-xs text-[var(--muted)]">
              Not an admin?{' '}
              <Link href="/" className="text-[var(--accent)] hover:underline">
                Return to home
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
