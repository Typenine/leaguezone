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
    <div style={{ background: 'var(--brand-ink)' }} className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="border border-[var(--border)] border-t-2 border-t-[var(--brand-gold)]/40 bg-[var(--surface)] p-8">
          <div className="text-center mb-6">
            <div className="text-4xl mb-3">🌐</div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="block w-4 h-px bg-[var(--brand-gold)]" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--brand-gold)]">Admin Access</span>
              <span className="block w-4 h-px bg-[var(--brand-gold)]" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-tight text-white">Admin Mode Login</h1>
            <p className="text-xs text-white/40 mt-1">
              Enter your league admin PIN or site admin key to manage newsletters, settings, and more.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="super-admin-key"
                className="block text-[10px] font-black uppercase tracking-[0.25em] text-[var(--brand-gold)] mb-2"
              >
                Admin Key
              </label>
              <input
                id="super-admin-key"
                type="password"
                autoComplete="current-password"
                autoFocus
                className="w-full border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2.5 text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--brand-gold)]/60 focus:ring-1 focus:ring-[var(--brand-gold)]/30 transition-colors"
                placeholder="League admin PIN"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !key}
              className="w-full py-2.5 bg-[var(--brand-gold)] text-[var(--brand-ink)] text-xs font-black uppercase tracking-wider hover:brightness-110 transition disabled:opacity-40"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>

            <p className="text-center text-xs text-white/30">
              Not an admin?{' '}
              <Link href="/" className="text-[var(--brand-gold)] hover:underline font-bold">
                Return to home
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
