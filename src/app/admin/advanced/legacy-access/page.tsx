'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type TeamPin = { team: string; hasPin: boolean; updatedAt: string | null; pinVersion: number | null; isDefault: boolean | null };

export default function LegacyAccessPage() {
  const [teams, setTeams] = useState<TeamPin[]>([]);
  const [pins, setPins] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/pins', { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (res.ok) setTeams(body.teams || []); else setMessage(body.error || 'Could not load legacy PINs');
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function save(team: string) {
    const newPin = (pins[team] || '').trim();
    if (!newPin) return;
    const res = await fetch('/api/admin/pins', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ team, newPin }) });
    const body = await res.json().catch(() => ({}));
    setMessage(res.ok ? `${team} legacy PIN updated.` : body.error || 'PIN update failed');
    if (res.ok) { setPins((prev) => ({ ...prev, [team]: '' })); await load(); }
  }
  return <div className="mx-auto max-w-5xl px-4 py-8"><div className="mb-6 flex items-start justify-between gap-3"><div><h1 className="text-3xl font-black text-[var(--text)]">Legacy Team PINs</h1><p className="mt-1 text-sm text-[var(--muted)]">Compatibility only for the older team-PIN authentication system. New LeagueZone leagues should use account membership and invites.</p></div><Link href="/admin/advanced" className="text-sm text-[var(--accent)]">Advanced Tools</Link></div>{message && <p className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">{message}</p>}{loading ? <p className="text-[var(--muted)]">Loading…</p> : <div className="space-y-2">{teams.map((team) => <div key={team.team} className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><p className="text-sm font-bold text-[var(--text)]">{team.team}</p><p className="text-xs text-[var(--muted)]">{team.hasPin ? `PIN v${team.pinVersion || 1}${team.isDefault ? ' · default' : ''}` : 'No PIN stored'}</p></div><input type="password" inputMode="numeric" placeholder="New PIN" value={pins[team.team] || ''} onChange={(e) => setPins((prev) => ({ ...prev, [team.team]: e.target.value }))} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"/><button onClick={() => save(team.team)} disabled={!pins[team.team]?.trim()} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold disabled:opacity-40">Update</button></div>)}</div>}</div>;
}
