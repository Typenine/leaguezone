'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SuperAdminLoginPage() {
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/super-admin-login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: key.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Invalid key');
      }
      router.push('/super-admin');
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
            <h1 className="text-xl font-bold text-[var(--text)]">Site Admin Login</h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              Enter your SUPER_ADMIN_KEY to access the site-wide admin dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="super-admin-key"
                className="block text-sm font-medium text-[var(--text)] mb-1"
              >
                Site Admin Key
              </label>
              <input
                id="super-admin-key"
                type="password"
                autoComplete="current-password"
                autoFocus
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-strong,var(--surface))] px-3 py-2 text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
                placeholder="Enter site admin key"
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
              Not a site admin?{' '}
              <a href="/" className="text-[var(--accent)] hover:underline">
                Return to home
              </a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
