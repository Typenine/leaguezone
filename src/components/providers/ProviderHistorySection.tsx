import Link from 'next/link';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import SectionHeader from '@/components/ui/SectionHeader';
import { getFantasyHistorySummary } from '@/lib/server/provider-deep-data';
import { getFantasyMatchups } from '@/lib/server/fantasy-data';
import { listLeagueProviderSeasons } from '@/lib/server/provider-seasons';

export type ProviderHistoryMode = 'franchises' | 'franchise' | 'stats' | 'milestones' | 'gamebook' | 'gamebook-week' | 'all-league';

function pct(wins: number, losses: number, ties: number): string {
  const games = wins + losses + ties;
  return games ? ((wins + ties * 0.5) / games).toFixed(3).replace(/^0/, '') : '.000';
}

export default async function ProviderHistorySection({
  leagueId,
  leagueSlug,
  mode,
  franchiseId,
  season,
  week,
}: {
  leagueId: string;
  leagueSlug: string;
  mode: ProviderHistoryMode;
  franchiseId?: string;
  season?: number;
  week?: number;
}) {
  const history = await getFantasyHistorySummary(leagueId).catch(() => null);
  if (!history) return <main className="container mx-auto px-4 py-8"><SectionHeader title="League History" /><p className="text-sm text-[var(--muted)]">Historical provider data is not available yet.</p></main>;
  const nameById = new Map(history.franchises.map((row) => [row.franchiseId, row.currentName] as const));

  if (mode === 'franchises') {
    return <main className="container mx-auto px-4 py-8"><SectionHeader title="Franchise History" subtitle="Franchise continuity across imported providers and seasons" /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{history.franchises.map((row) => <Link key={row.franchiseId} href={`/l/${leagueSlug}/history/franchises/${encodeURIComponent(row.franchiseId)}`}><Card className="h-full transition hover:border-[var(--accent)]"><CardContent className="p-5"><h2 className="text-lg font-black">{row.currentName}</h2><p className="mt-1 text-sm text-[var(--muted)]">{row.seasons[0]}{row.seasons.length > 1 ? `–${row.seasons[row.seasons.length - 1]}` : ''} · {row.seasons.length} season{row.seasons.length === 1 ? '' : 's'}</p><div className="mt-4 text-2xl font-black">{row.wins}-{row.losses}{row.ties ? `-${row.ties}` : ''}</div><p className="mt-1 text-xs text-[var(--muted)]">{pct(row.wins, row.losses, row.ties)} · {row.pointsFor.toFixed(2)} PF</p></CardContent></Card></Link>)}</div></main>;
  }

  if (mode === 'franchise') {
    const row = history.franchises.find((item) => item.franchiseId === franchiseId);
    if (!row) return <main className="container mx-auto px-4 py-8"><SectionHeader title="Franchise not found" /></main>;
    const opponents = history.headToHead.flatMap((record) => {
      if (record.franchiseA === row.franchiseId) return [{ opponent: nameById.get(record.franchiseB) || 'Franchise', wins: record.aWins, losses: record.bWins, ties: record.ties }];
      if (record.franchiseB === row.franchiseId) return [{ opponent: nameById.get(record.franchiseA) || 'Franchise', wins: record.bWins, losses: record.aWins, ties: record.ties }];
      return [];
    }).sort((a, b) => (b.wins + b.losses + b.ties) - (a.wins + a.losses + a.ties));
    return <main className="container mx-auto px-4 py-8"><SectionHeader title={row.currentName} subtitle={`${row.seasons.length} historical season${row.seasons.length === 1 ? '' : 's'}`} actions={<Link href={`/l/${leagueSlug}/history/franchises`} className="text-sm font-bold text-[var(--accent)]">All franchises</Link>} /><div className="mt-5 grid gap-4 sm:grid-cols-3"><Card><CardContent className="p-5"><p className="text-xs font-bold uppercase text-[var(--muted)]">All-time record</p><p className="mt-1 text-3xl font-black">{row.wins}-{row.losses}{row.ties ? `-${row.ties}` : ''}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-xs font-bold uppercase text-[var(--muted)]">Points For</p><p className="mt-1 text-3xl font-black">{row.pointsFor.toFixed(1)}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-xs font-bold uppercase text-[var(--muted)]">Seasons</p><p className="mt-1 text-3xl font-black">{row.seasons.length}</p></CardContent></Card></div><Card className="mt-5"><CardHeader><CardTitle>Head-to-Head</CardTitle></CardHeader><CardContent className="divide-y divide-[var(--border)]">{opponents.map((opponent) => <div key={opponent.opponent} className="flex justify-between gap-4 py-2 text-sm"><span className="font-semibold">{opponent.opponent}</span><span>{opponent.wins}-{opponent.losses}{opponent.ties ? `-${opponent.ties}` : ''}</span></div>)}</CardContent></Card></main>;
  }

  if (mode === 'stats') {
    const wins = [...history.franchises].sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor);
    const points = [...history.franchises].sort((a, b) => b.pointsFor - a.pointsFor);
    return <main className="container mx-auto px-4 py-8"><SectionHeader title="Stats & Records" subtitle="Normalized records across every connected provider season" /><div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle>All-Time Wins</CardTitle></CardHeader><CardContent className="divide-y divide-[var(--border)]">{wins.map((row, index) => <div key={row.franchiseId} className="flex justify-between py-2 text-sm"><span><strong>{index + 1}.</strong> {row.currentName}</span><strong>{row.wins}</strong></div>)}</CardContent></Card><Card><CardHeader><CardTitle>All-Time Points</CardTitle></CardHeader><CardContent className="divide-y divide-[var(--border)]">{points.map((row, index) => <div key={row.franchiseId} className="flex justify-between py-2 text-sm"><span><strong>{index + 1}.</strong> {row.currentName}</span><strong>{row.pointsFor.toFixed(1)}</strong></div>)}</CardContent></Card></div><Card className="mt-6"><CardHeader><CardTitle>Highest Weekly Scores</CardTitle></CardHeader><CardContent className="divide-y divide-[var(--border)]">{history.topScoringWeeks.map((row, index) => <div key={`${row.season}-${row.week}-${row.franchiseId}-${index}`} className="flex justify-between gap-4 py-2 text-sm"><span>{index + 1}. <strong>{row.teamName}</strong> · {row.season} W{row.week}</span><strong>{row.points.toFixed(2)}</strong></div>)}</CardContent></Card></main>;
  }

  if (mode === 'milestones') {
    const winsLeader = [...history.franchises].sort((a, b) => b.wins - a.wins)[0];
    const pointsLeader = [...history.franchises].sort((a, b) => b.pointsFor - a.pointsFor)[0];
    const high = history.topScoringWeeks[0];
    return <main className="container mx-auto px-4 py-8"><SectionHeader title="League Milestones" subtitle="Provider-neutral historical landmarks" /><div className="grid gap-4 md:grid-cols-3">{winsLeader && <Card><CardContent className="p-5"><p className="text-xs font-black uppercase text-[var(--muted)]">Wins leader</p><p className="mt-2 text-xl font-black">{winsLeader.currentName}</p><p className="mt-1 text-sm text-[var(--muted)]">{winsLeader.wins} all-time wins</p></CardContent></Card>}{pointsLeader && <Card><CardContent className="p-5"><p className="text-xs font-black uppercase text-[var(--muted)]">Points leader</p><p className="mt-2 text-xl font-black">{pointsLeader.currentName}</p><p className="mt-1 text-sm text-[var(--muted)]">{pointsLeader.pointsFor.toFixed(1)} all-time PF</p></CardContent></Card>}{high && <Card><CardContent className="p-5"><p className="text-xs font-black uppercase text-[var(--muted)]">Single-week high</p><p className="mt-2 text-xl font-black">{high.teamName}</p><p className="mt-1 text-sm text-[var(--muted)]">{high.points.toFixed(2)} · {high.season} Week {high.week}</p></CardContent></Card>}</div></main>;
  }

  if (mode === 'gamebook') {
    const seasons = await listLeagueProviderSeasons(leagueId);
    return <main className="container mx-auto px-4 py-8"><SectionHeader title="Weekly Gamebooks" subtitle="Open any imported provider season and week" /><div className="space-y-5">{seasons.map((row) => <Card key={row.season}><CardHeader><CardTitle>{row.season} · {row.provider === 'yahoo' ? 'Yahoo Fantasy' : 'Sleeper'}</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{Array.from({ length: 18 }, (_, index) => index + 1).map((gameWeek) => <Link key={gameWeek} href={`/l/${leagueSlug}/history/gamebook/${row.season}/${gameWeek}`} className="rounded-md border border-[var(--border)] px-3 py-2 text-xs font-bold hover:border-[var(--accent)]">Week {gameWeek}</Link>)}</CardContent></Card>)}</div></main>;
  }

  if (mode === 'gamebook-week' && season && week) {
    const matchups = await getFantasyMatchups(leagueId, week, season).catch(() => []);
    return <main className="container mx-auto px-4 py-8"><SectionHeader title={`${season} Week ${week} Gamebook`} actions={<Link href={`/l/${leagueSlug}/history/gamebook`} className="text-sm font-bold text-[var(--accent)]">All gamebooks</Link>} />{matchups.length === 0 ? <Card><CardContent className="p-5 text-sm text-[var(--muted)]">No matchups were returned for this week.</CardContent></Card> : <div className="grid gap-4 lg:grid-cols-2">{matchups.map((matchup) => <Link key={matchup.matchupId} href={`/l/${leagueSlug}/matchups/${week}/${matchup.matchupId}?year=${season}`}><Card className="h-full transition hover:border-[var(--accent)]"><CardContent className="p-5">{matchup.teams.map((side) => <div key={side.providerTeamId} className="flex justify-between gap-3 py-2"><strong>{side.teamName}</strong><strong>{side.points.toFixed(2)}</strong></div>)}</CardContent></Card></Link>)}</div>}</main>;
  }

  return <main className="container mx-auto px-4 py-8"><SectionHeader title="All-League History" subtitle="Annual player honors" /><Card><CardContent className="p-5"><p className="text-sm text-[var(--muted)]">LeagueZone can import Yahoo weekly player scoring for individual gamebooks, but it does not mass-generate historical All-League player awards unless every weekly lineup has been verified. This page remains intentionally conservative rather than assigning players to the wrong historical franchise after trades or lineup changes.</p><p className="mt-3 text-sm"><Link href={`/l/${leagueSlug}/history/gamebook`} className="font-bold text-[var(--accent)]">Browse verified weekly gamebooks →</Link></p></CardContent></Card></main>;
}
