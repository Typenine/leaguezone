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
