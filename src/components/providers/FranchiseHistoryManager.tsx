'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import SectionHeader from '@/components/ui/SectionHeader';
import Select from '@/components/ui/Select';

type Row = { franchiseId: string; displayName: string; season: number; provider: string; providerTeamId: string; rosterId: number; teamName: string };
type Group = { id: string; name: string; rows: Row[] };

export default function FranchiseHistoryManager({ leagueId }: { leagueId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [isCommissioner, setIsCommissioner] = useState(false);
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/settings/franchise-history?leagueId=${encodeURIComponent(leagueId)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load franchise history.');
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setIsCommissioner(Boolean(data.isCommissioner));
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load franchise history.'); }
    finally { setLoading(false); }
  }, [leagueId]);

  useEffect(() => { load(); }, [load]);
  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const row of rows) {
      const group = map.get(row.franchiseId) || { id: row.franchiseId, name: row.displayName, rows: [] };
      group.rows.push(row); map.set(row.franchiseId, group);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  async function merge() {
    if (!source || !target || source === target) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/settings/franchise-history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leagueId, sourceFranchiseId: source, targetFranchiseId: target }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to merge franchise history.');
      setSource(''); setTarget(''); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to merge franchise history.'); }
    finally { setSaving(false); }
  }

  return <main className="container mx-auto space-y-6 px-4 py-8"><SectionHeader title="Franchise History Mapping" subtitle="Confirm when teams from different seasons or providers belong to the same continuous franchise." />{error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}{loading ? <p className="text-[var(--muted)]">Loading franchise history…</p> : <><div className="grid gap-4 md:grid-cols-2">{groups.map((group) => <Card key={group.id}><CardHeader><CardTitle>{group.name}</CardTitle></CardHeader><CardContent className="space-y-2">{group.rows.map((row) => <div key={`${row.season}-${row.providerTeamId}`} className="flex justify-between gap-3 text-sm"><span>{row.season} · {row.provider === 'yahoo' ? 'Yahoo Fantasy' : 'Sleeper'}</span><span className="font-semibold">{row.teamName}</span></div>)}</CardContent></Card>)}</div>{isCommissioner && groups.length > 1 && <Card><CardHeader><CardTitle>Merge franchise histories</CardTitle></CardHeader><CardContent><p className="mb-4 text-sm text-[var(--muted)]">Use this only when both groups represent the same league franchise. The target franchise is kept and the source history is moved into it.</p><div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"><Select value={source} onChange={(event) => setSource(event.target.value)}><option value="">History to move…</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</Select><Select value={target} onChange={(event) => setTarget(event.target.value)}><option value="">Keep as…</option>{groups.filter((group) => group.id !== source).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</Select><Button onClick={merge} disabled={!source || !target || source === target || saving}>{saving ? 'Merging…' : 'Merge'}</Button></div></CardContent></Card>}</>}</main>;
}
