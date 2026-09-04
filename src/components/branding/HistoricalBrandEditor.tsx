'use client';

import { useEffect, useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import Select from '@/components/ui/Select';

type Snapshot = {
  franchiseKey: string;
  season: number;
  rosterId: number | null;
  teamName: string;
  abbreviation: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  tertiaryColor: string | null;
  quaternaryColor: string | null;
};

type Draft = Snapshot;

async function uploadHistoricalLogo(file: File, snapshot: Snapshot): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('type', 'history-logo');
  form.append('season', String(snapshot.season));
  form.append('franchiseKey', snapshot.franchiseKey);
  const res = await fetch('/api/upload', { method: 'POST', body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.url) throw new Error(body.error || 'Upload failed');
  return body.url as string;
}

export default function HistoricalBrandEditor() {
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [season, setSeason] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [status, setStatus] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    const res = await fetch('/api/settings/branding/history-sync', { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not load history');
    const next = (body.history || []) as Snapshot[];
    setHistory(next);
    setDrafts(Object.fromEntries(next.map((entry) => [`${entry.season}:${entry.franchiseKey}`, { ...entry }])));
    const seasons = Array.from(new Set(next.map((entry) => entry.season))).sort((a, b) => b - a);
    setSeason((current) => current && seasons.includes(current) ? current : (seasons[0] || null));
  };

  useEffect(() => {
    load().catch((error) => setStatus(error instanceof Error ? error.message : 'Could not load history'));
  }, []);

  const seasons = useMemo(
    () => Array.from(new Set(history.map((entry) => entry.season))).sort((a, b) => b - a),
    [history],
  );
  const visible = history.filter((entry) => entry.season === season);

  const updateDraft = (snapshot: Snapshot, patch: Partial<Draft>) => {
    const key = `${snapshot.season}:${snapshot.franchiseKey}`;
    setDrafts((prev) => ({ ...prev, [key]: { ...(prev[key] || snapshot), ...patch } }));
  };

  const save = async (snapshot: Snapshot) => {
    const key = `${snapshot.season}:${snapshot.franchiseKey}`;
    const draft = drafts[key] || snapshot;
    setBusyKey(key);
    setStatus('');
    try {
      const res = await fetch('/api/settings/branding/history-sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Save failed');
      setStatus(`${draft.teamName} ${draft.season} branding saved.`);
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setBusyKey(null);
    }
  };

  const sync = async () => {
    setSyncing(true);
    setStatus('');
    try {
      const res = await fetch('/api/settings/branding/history-sync', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Sync failed');
      setStatus(`Synced ${body.snapshots ?? 0} franchise-season snapshots across ${body.seasons ?? 0} seasons${body.errors ? ` with ${body.errors} season errors` : ''}.`);
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xs">
          <Label htmlFor="branding-history-season">Season</Label>
          <Select
            id="branding-history-season"
            value={season ?? ''}
            onChange={(event) => setSeason(Number(event.target.value))}
            disabled={seasons.length === 0}
          >
            {seasons.length === 0 ? <option value="">No snapshots yet</option> : null}
            {seasons.map((year) => <option key={year} value={year}>{year}</option>)}
          </Select>
        </div>
        <Button variant="secondary" onClick={sync} disabled={syncing}>{syncing ? 'Syncing…' : 'Sync from Sleeper'}</Button>
      </div>

      <p className="text-sm text-[var(--muted)]">Sleeper supplies historical names, but not historical logos or colors. Use these season snapshots to correct old names and preserve the visuals that actually belonged to each franchise that year. Manual commissioner edits are protected from later provider syncs.</p>

      {status ? <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)]">{status}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((snapshot) => {
          const key = `${snapshot.season}:${snapshot.franchiseKey}`;
          const draft = drafts[key] || snapshot;
          return (
            <div key={key} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)]">
                  {draft.logoUrl ? <img src={draft.logoUrl} alt={`${draft.teamName} ${draft.season} logo`} className="h-full w-full object-contain" /> : <span className="text-[10px] text-[var(--muted)]">No logo</span>}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-bold text-[var(--text)]">{draft.teamName}</p>
                  <p className="text-xs text-[var(--muted)]">{draft.season} · Franchise slot {draft.rosterId ?? 'unknown'}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2"><Label>Historical team name</Label><Input value={draft.teamName} onChange={(e) => updateDraft(snapshot, { teamName: e.target.value })} /></div>
                <div><Label>Abbreviation</Label><Input value={draft.abbreviation || ''} maxLength={32} onChange={(e) => updateDraft(snapshot, { abbreviation: e.target.value })} /></div>
                <div>
                  <Label>Historical logo</Label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <label className="cursor-pointer rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--text)] hover:border-[var(--accent)]">
                      Upload
                      <input
                        className="hidden"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          try {
                            setBusyKey(key);
                            const url = await uploadHistoricalLogo(file, snapshot);
                            updateDraft(snapshot, { logoUrl: url });
                            setStatus('Image uploaded. Save this season entry to apply it.');
                          } catch (error) {
                            setStatus(error instanceof Error ? error.message : 'Upload failed');
                          } finally {
                            setBusyKey(null);
                            event.target.value = '';
                          }
                        }}
                      />
                    </label>
                    {draft.logoUrl ? <button type="button" className="text-xs text-red-400" onClick={() => updateDraft(snapshot, { logoUrl: null })}>Remove</button> : null}
                  </div>
                </div>
                {([
                  ['primaryColor', 'Primary', '#1a1a2e'],
                  ['secondaryColor', 'Secondary', '#16213e'],
                  ['tertiaryColor', 'Tertiary', '#333333'],
                  ['quaternaryColor', 'Quaternary', '#444444'],
                ] as const).map(([field, label, fallback]) => (
                  <div key={field}>
                    <Label>{label}</Label>
                    <div className="mt-1 flex gap-2">
                      <input type="color" value={draft[field] || fallback} onChange={(e) => updateDraft(snapshot, { [field]: e.target.value })} className="h-10 w-11 shrink-0 rounded border border-[var(--border)]" />
                      <Input value={draft[field] || ''} onChange={(e) => updateDraft(snapshot, { [field]: e.target.value })} placeholder={field === 'primaryColor' || field === 'secondaryColor' ? fallback : 'Optional'} />
                    </div>
                  </div>
                ))}
              </div>
              <Button className="mt-4 w-full sm:w-auto" onClick={() => save(snapshot)} disabled={busyKey === key}>{busyKey === key ? 'Saving…' : `Save ${snapshot.season} branding`}</Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
