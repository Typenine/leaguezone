'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch('/api/super-admin-login', { method: 'DELETE' });
      router.push('/');
    } catch {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="px-3 py-2 rounded-lg border border-red-500/40 text-sm text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
    >
      {loading ? 'Exiting…' : 'Exit Admin Mode'}
    </button>
  );
}

export interface SwitchLeagueButtonProps {
  leagueId: string;
  leagueName: string;
  destination?: string;
  label?: string;
  variant?: 'primary' | 'secondary';
}

export function SwitchLeagueButton({
  leagueId,
  destination = '/home',
  label = 'Enter League',
  variant = 'primary',
}: SwitchLeagueButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleSwitch = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/super-admin/switch-league', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ leagueId, next: destination }),
      });
      if (res.redirected) {
        window.location.href = res.url;
      } else if (res.ok) {
        window.location.href = destination;
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  };

  const base = 'text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50';
  const styles =
    variant === 'primary'
      ? `${base} bg-[var(--accent)] text-white hover:opacity-90`
      : `${base} border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-strong)]`;

  return (
    <button onClick={handleSwitch} disabled={loading} className={styles}>
      {loading ? '…' : label}
    </button>
  );
}

// ── Dedup Invites ──────────────────────────────────────────────────────────────

export function DedupInvitesButton({ leagueId }: { leagueId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleDedup = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/super-admin/league/${leagueId}/dedup-invites`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Dedup failed');
      const removed: number = data.removed ?? 0;
      setResult(removed === 0 ? 'No duplicates found' : `Removed ${removed} duplicate${removed === 1 ? '' : 's'}`);
      // Reload page so member counts refresh
      if (removed > 0) setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleDedup}
        disabled={loading}
        className="text-xs px-3 py-1.5 rounded-lg border border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
      >
        {loading ? 'Deduping…' : 'Fix Duplicates'}
      </button>
      {result && (
        <span className="text-xs text-[var(--muted)]">{result}</span>
      )}
    </div>
  );
}

// ── Delete League ──────────────────────────────────────────────────────────────

export function DeleteLeagueButton({
  leagueId,
  leagueName,
}: {
  leagueId: string;
  leagueName: string;
}) {
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/super-admin/league/${leagueId}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Delete failed');
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      setLoading(false);
      setConfirm(false);
    }
  };

  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        className="text-xs px-3 py-1.5 rounded-lg border border-red-500/40 text-red-500 hover:bg-red-500/10 transition-colors"
      >
        Delete League
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 mt-1">
      <p className="text-xs text-red-500 font-medium">
        Delete &ldquo;{leagueName}&rdquo; and all its invites? This cannot be undone.
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Deleting…' : 'Yes, delete'}
        </button>
        <button
          onClick={() => { setConfirm(false); setError(null); }}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
