'use client';

import { useCallback, useEffect, useState } from 'react';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

type Rule = { id: string; type: 'hide_url' | 'block_match' | 'block_headline'; value: string; reason?: string | null; createdAt?: string };

export default function NewsModerationPanel({ leagueSlug }: { leagueSlug?: string }) {
  const endpoint = `/api/admin/news-moderation${leagueSlug ? `?league=${encodeURIComponent(leagueSlug)}` : ''}`;
  const [rules, setRules] = useState<Rule[]>([]); const [type, setType] = useState<Rule['type']>('hide_url'); const [value, setValue] = useState(''); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(() => fetch(endpoint, { cache: 'no-store' }).then((response) => response.json()).then((data) => setRules(Array.isArray(data.rules) ? data.rules : [])).catch(() => setRules([])), [endpoint]);
  useEffect(() => { void load(); }, [load]);
  async function add() { if (!value.trim()) return; setBusy(true); try { const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type, value, reason }) }); if (!response.ok) throw new Error((await response.json()).error || 'Unable to add rule'); setValue(''); setReason(''); await load(); } catch (error) { alert(error instanceof Error ? error.message : 'Unable to add rule'); } finally { setBusy(false); } }
  async function remove(id: string) { setBusy(true); try { await fetch(endpoint, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) }); await load(); } finally { setBusy(false); } }
  return <section className="container mx-auto max-w-5xl px-4 pb-10"><Card><CardHeader><CardTitle>News Moderation</CardTitle></CardHeader><CardContent><p className="mb-4 text-sm text-[var(--muted)]">Hide a specific URL or suppress stories matching a headline or player phrase for this league.</p><div className="grid gap-3 md:grid-cols-[180px_1fr_1fr_auto]"><Select aria-label="Moderation rule type" value={type} onChange={(event) => setType(event.target.value as Rule['type'])}><option value="hide_url">Hide URL</option><option value="block_headline">Block headline phrase</option><option value="block_match">Block player or text match</option></Select><Input aria-label="Moderation value" placeholder="URL or phrase" value={value} onChange={(event) => setValue(event.target.value)} /><Input aria-label="Moderation reason" placeholder="Reason, optional" value={reason} onChange={(event) => setReason(event.target.value)} /><Button disabled={busy || !value.trim()} onClick={add}>Add rule</Button></div><div className="mt-5 space-y-2">{rules.length ? rules.map((rule) => <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-3"><div className="min-w-0"><div className="text-xs font-black uppercase text-[var(--accent)]">{rule.type.replaceAll('_', ' ')}</div><div className="break-all text-sm font-bold">{rule.value}</div>{rule.reason && <div className="text-xs text-[var(--muted)]">{rule.reason}</div>}</div><Button variant="ghost" size="sm" disabled={busy} onClick={() => remove(rule.id)}>Restore</Button></div>) : <p className="text-sm text-[var(--muted)]">No active moderation rules.</p>}</div></CardContent></Card></section>;
}
