'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import Select from '@/components/ui/Select';

type LeagueBranding = {
  slug: string | null;
  name: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  canManage: boolean;
};

type TeamBranding = {
  teamName?: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  tertiaryColor: string | null;
  quaternaryColor: string | null;
};

const CARD_TYPES = [
  ['league', 'League'],
  ['matchup', 'Matchup'],
  ['standings', 'Standings'],
  ['champion', 'Champion'],
  ['draft', 'Draft'],
  ['trade', 'Trade'],
  ['record', 'Record'],
  ['power', 'Power Rankings'],
  ['newsletter', 'Newsletter'],
  ['hall-of-fame', 'Hall of Fame'],
] as const;

async function uploadBrandImage(file: File, type: 'league-logo' | 'team-logo'): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('type', type);
  const res = await fetch('/api/upload', { method: 'POST', body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.url) throw new Error(body.error || 'Upload failed');
  return body.url as string;
}

export default function BrandingSettingsPage() {
  const [league, setLeague] = useState<LeagueBranding | null>(null);
  const [team, setTeam] = useState<TeamBranding | null>(null);
  const [leagueStatus, setLeagueStatus] = useState('');
  const [teamStatus, setTeamStatus] = useState('');
  const [historyStatus, setHistoryStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const [cardType, setCardType] = useState<(typeof CARD_TYPES)[number][0]>('league');
  const [cardTitle, setCardTitle] = useState('');
  const [cardSubtitle, setCardSubtitle] = useState('');
  const [cardLeft, setCardLeft] = useState('');
  const [cardRight, setCardRight] = useState('');
  const [cardFooter, setCardFooter] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/settings/branding', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/settings/team', { cache: 'no-store' }).then(async (r) => (r.ok ? r.json() : null)),
    ]).then(([leagueData, teamData]) => {
      setLeague(leagueData as LeagueBranding);
      setTeam(teamData as TeamBranding | null);
    }).catch(() => setLeagueStatus('Could not load branding settings.'));
  }, []);

  const cardUrl = useMemo(() => {
    if (!league?.slug) return '';
    const params = new URLSearchParams({ type: cardType });
    if (cardTitle.trim()) params.set('title', cardTitle.trim());
    if (cardSubtitle.trim()) params.set('subtitle', cardSubtitle.trim());
    if (cardLeft.trim()) params.set('left', cardLeft.trim());
    if (cardRight.trim()) params.set('right', cardRight.trim());
    if (cardFooter.trim()) params.set('footer', cardFooter.trim());
    return `/api/share-card/${encodeURIComponent(league.slug)}?${params.toString()}`;
  }, [league?.slug, cardType, cardTitle, cardSubtitle, cardLeft, cardRight, cardFooter]);

  const saveLeague = async () => {
    if (!league) return;
    setBusy(true);
    setLeagueStatus('');
    try {
      const res = await fetch('/api/settings/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logoUrl: league.logoUrl || '',
          primaryColor: league.primaryColor || '',
          secondaryColor: league.secondaryColor || '',
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Save failed');
      setLeagueStatus('League branding saved.');
    } catch (error) {
      setLeagueStatus(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const saveTeam = async () => {
    if (!team) return;
    setBusy(true);
    setTeamStatus('');
    try {
      const res = await fetch('/api/settings/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logoUrl: team.logoUrl || '',
          primaryColor: team.primaryColor || '',
          secondaryColor: team.secondaryColor || '',
          tertiaryColor: team.tertiaryColor || '',
          quaternaryColor: team.quaternaryColor || '',
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Save failed');
      setTeamStatus('Team branding saved and current-season history snapshot updated.');
    } catch (error) {
      setTeamStatus(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const syncHistory = async () => {
    setBusy(true);
    setHistoryStatus('');
    try {
      const res = await fetch('/api/settings/branding/history-sync', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Sync failed');
      setHistoryStatus(`Synced ${body.snapshots ?? 0} franchise-season snapshots across ${body.seasons ?? 0} seasons${body.errors ? ` with ${body.errors} season errors` : ''}.`);
    } catch (error) {
      setHistoryStatus(error instanceof Error ? error.message : 'Sync failed');
    } finally {
      setBusy(false);
    }
  };

  if (!league) {
    return <div className="container mx-auto max-w-5xl px-4 py-10 text-[var(--muted)]">Loading branding settings…</div>;
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">Brand system</p>
          <h1 className="text-2xl font-black text-[var(--text)] sm:text-3xl">Branding</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Manage league and team identity, historical snapshots, and share graphics.</p>
        </div>
        {league.slug ? <Link href={`/l/${league.slug}`} className="text-sm font-semibold text-[var(--accent)]">Back to league</Link> : null}
      </div>

      {league.canManage ? (
        <Card>
          <CardHeader><CardTitle>League identity</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-5 md:grid-cols-[180px_1fr]">
              <div>
                <Label>League logo</Label>
                <div className="mt-2 flex h-36 w-36 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                  {league.logoUrl ? <img src={league.logoUrl} alt="League logo preview" className="h-full w-full object-contain" /> : <span className="text-xs text-[var(--muted)]">No logo</span>}
                </div>
                <label className="mt-3 inline-flex cursor-pointer rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--text)] hover:border-[var(--accent)]">
                  Upload image
                  <input
                    className="hidden"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      try {
                        setBusy(true);
                        const url = await uploadBrandImage(file, 'league-logo');
                        setLeague((prev) => prev ? { ...prev, logoUrl: url } : prev);
                        setLeagueStatus('Image uploaded. Save branding to apply it.');
                      } catch (error) {
                        setLeagueStatus(error instanceof Error ? error.message : 'Upload failed');
                      } finally {
                        setBusy(false);
                        event.target.value = '';
                      }
                    }}
                  />
                </label>
                {league.logoUrl ? <button type="button" className="ml-2 text-xs text-red-400" onClick={() => setLeague((prev) => prev ? { ...prev, logoUrl: null } : prev)}>Remove</button> : null}
              </div>
              <div className="grid content-start gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="league-primary">Primary color</Label>
                  <div className="mt-1 flex gap-2"><input type="color" value={league.primaryColor || '#0b5f98'} onChange={(e) => setLeague({ ...league, primaryColor: e.target.value })} className="h-10 w-12 rounded border border-[var(--border)]" /><Input id="league-primary" value={league.primaryColor || ''} onChange={(e) => setLeague({ ...league, primaryColor: e.target.value })} placeholder="#0b5f98" /></div>
                </div>
                <div>
                  <Label htmlFor="league-secondary">Secondary color</Label>
                  <div className="mt-1 flex gap-2"><input type="color" value={league.secondaryColor || '#be161e'} onChange={(e) => setLeague({ ...league, secondaryColor: e.target.value })} className="h-10 w-12 rounded border border-[var(--border)]" /><Input id="league-secondary" value={league.secondaryColor || ''} onChange={(e) => setLeague({ ...league, secondaryColor: e.target.value })} placeholder="#be161e" /></div>
                </div>
                <p className="sm:col-span-2 text-xs text-[var(--muted)]">LeagueZone derives readable foregrounds, highlights, borders, chart colors, and share-card accents from these semantic roles.</p>
              </div>
            </div>
            {leagueStatus ? <p className="text-sm text-[var(--muted)]">{leagueStatus}</p> : null}
            <Button onClick={saveLeague} disabled={busy}>Save league branding</Button>
          </CardContent>
        </Card>
      ) : null}

      {team ? (
        <Card>
          <CardHeader><CardTitle>{team.teamName ? `${team.teamName} identity` : 'Team identity'}</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-5 md:grid-cols-[180px_1fr]">
              <div>
                <Label>Team logo</Label>
                <div className="mt-2 flex h-36 w-36 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                  {team.logoUrl ? <img src={team.logoUrl} alt="Team logo preview" className="h-full w-full object-contain" /> : <span className="text-xs text-[var(--muted)]">Default helmet</span>}
                </div>
                <label className="mt-3 inline-flex cursor-pointer rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--text)] hover:border-[var(--accent)]">
                  Upload image
                  <input
                    className="hidden"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      try {
                        setBusy(true);
                        const url = await uploadBrandImage(file, 'team-logo');
                        setTeam((prev) => prev ? { ...prev, logoUrl: url } : prev);
                        setTeamStatus('Image uploaded. Save team branding to apply it.');
                      } catch (error) {
                        setTeamStatus(error instanceof Error ? error.message : 'Upload failed');
                      } finally {
                        setBusy(false);
                        event.target.value = '';
                      }
                    }}
                  />
                </label>
                {team.logoUrl ? <button type="button" className="ml-2 text-xs text-red-400" onClick={() => setTeam((prev) => prev ? { ...prev, logoUrl: null } : prev)}>Use helmet</button> : null}
              </div>
              <div className="grid content-start gap-4 sm:grid-cols-2">
                {([
                  ['primaryColor', 'Primary', '#1a1a2e'],
                  ['secondaryColor', 'Secondary', '#16213e'],
                  ['tertiaryColor', 'Tertiary (optional)', '#333333'],
                  ['quaternaryColor', 'Quaternary (optional)', '#444444'],
                ] as const).map(([key, label, fallback]) => (
                  <div key={key}>
                    <Label>{label}</Label>
                    <div className="mt-1 flex gap-2">
                      <input type="color" value={team[key] || fallback} onChange={(e) => setTeam({ ...team, [key]: e.target.value })} className="h-10 w-12 rounded border border-[var(--border)]" />
                      <Input value={team[key] || ''} onChange={(e) => setTeam({ ...team, [key]: e.target.value })} placeholder={fallback} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {teamStatus ? <p className="text-sm text-[var(--muted)]">{teamStatus}</p> : null}
            <Button onClick={saveTeam} disabled={busy}>Save team branding</Button>
          </CardContent>
        </Card>
      ) : null}

      {league.canManage ? (
        <Card>
          <CardHeader><CardTitle>Historical franchise branding</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-[var(--muted)]">Sync every connected Sleeper season into LeagueZone’s season snapshots. Historical names are taken from that season. Existing historical logos and colors are never overwritten by blank provider data.</p>
            <Button variant="secondary" onClick={syncHistory} disabled={busy}>Sync branding history</Button>
            {historyStatus ? <p className="text-sm text-[var(--muted)]">{historyStatus}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {league.slug ? (
        <Card>
          <CardHeader><CardTitle>Share card studio</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div><Label>Card type</Label><Select value={cardType} onChange={(e) => setCardType(e.target.value as typeof cardType)}>{CARD_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div>
              <div><Label>Title</Label><Input value={cardTitle} onChange={(e) => setCardTitle(e.target.value)} placeholder="Uses a type-specific default" /></div>
              <div><Label>Subtitle</Label><Input value={cardSubtitle} onChange={(e) => setCardSubtitle(e.target.value)} placeholder="Optional context" /></div>
              <div><Label>Left detail</Label><Input value={cardLeft} onChange={(e) => setCardLeft(e.target.value)} placeholder="Team, score, pick, etc." /></div>
              <div><Label>Right detail</Label><Input value={cardRight} onChange={(e) => setCardRight(e.target.value)} placeholder="Opponent, return, record, etc." /></div>
              <div><Label>Footer</Label><Input value={cardFooter} onChange={(e) => setCardFooter(e.target.value)} placeholder="Optional footer" /></div>
            </div>
            <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <img src={cardUrl} alt="League-branded share card preview" className="block w-full" />
            </div>
            <div className="flex flex-wrap gap-3">
              <a href={cardUrl} target="_blank" rel="noreferrer"><Button type="button">Open full-size card</Button></a>
              <button type="button" className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)]" onClick={() => navigator.clipboard?.writeText(new URL(cardUrl, window.location.origin).toString())}>Copy card URL</button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
