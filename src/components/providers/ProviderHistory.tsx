import Link from 'next/link';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import SectionHeader from '@/components/ui/SectionHeader';
import { getFantasyHistorySummary } from '@/lib/server/provider-deep-data';

function pct(wins: number, losses: number, ties: number): string {
  const games = wins + losses + ties;
  return games ? ((wins + ties * 0.5) / games).toFixed(3).replace(/^0/, '') : '.000';
}

export default async function ProviderHistory({ leagueId, leagueSlug }: { leagueId: string; leagueSlug: string }) {
  const history = await getFantasyHistorySummary(leagueId).catch(() => null);
  if (!history) return <div className="container mx-auto px-4 py-8"><SectionHeader title="League History" /><p className="text-[var(--muted)]">Historical provider data is not available yet.</p></div>;
  const nameById = new Map(history.franchises.map((row) => [row.franchiseId, row.currentName] as const));
  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <SectionHeader title="League History" subtitle={`${history.seasons.length} imported season${history.seasons.length === 1 ? '' : 's'} · ${history.providers.map((provider) => provider === 'yahoo' ? 'Yahoo Fantasy' : 'Sleeper').join(' + ')}`} actions={<Link href={`/l/${leagueSlug}/settings/franchise-history`} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold">Franchise mapping</Link>} />
      <Card><CardHeader><CardTitle>All-Time Franchise Records</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead><tr className="border-b border-[var(--border)] text-left text-[var(--muted)]"><th className="py-2">Franchise</th><th>Seasons</th><th>Record</th><th>Win %</th><th>PF</th><th>PA</th></tr></thead><tbody>{history.franchises.map((row) => <tr key={row.franchiseId} className="border-b border-[var(--border)]/60"><td className="py-2 font-semibold">{row.currentName}</td><td>{row.seasons.length}</td><td>{row.wins}-{row.losses}{row.ties ? `-${row.ties}` : ''}</td><td>{pct(row.wins, row.losses, row.ties)}</td><td>{row.pointsFor.toFixed(2)}</td><td>{row.pointsAgainst.toFixed(2)}</td></tr>)}</tbody></table></CardContent></Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Top Scoring Weeks</CardTitle></CardHeader><CardContent><div className="divide-y divide-[var(--border)]">{history.topScoringWeeks.slice(0, 10).map((row, index) => <div key={`${row.season}-${row.week}-${row.franchiseId}-${index}`} className="flex justify-between gap-4 py-2 text-sm"><span><strong>{row.teamName}</strong> · {row.season} W{row.week}</span><strong>{row.points.toFixed(2)}</strong></div>)}</div></CardContent></Card>
        <Card><CardHeader><CardTitle>Head-to-Head</CardTitle></CardHeader><CardContent><div className="divide-y divide-[var(--border)]">{history.headToHead.sort((a, b) => (b.aWins + b.bWins + b.ties) - (a.aWins + a.bWins + a.ties)).slice(0, 15).map((row) => <div key={`${row.franchiseA}-${row.franchiseB}`} className="py-2 text-sm"><p className="font-semibold">{nameById.get(row.franchiseA) || 'Franchise'} vs. {nameById.get(row.franchiseB) || 'Franchise'}</p><p className="text-[var(--muted)]">{row.aWins}-{row.bWins}{row.ties ? `-${row.ties}` : ''}</p></div>)}</div></CardContent></Card>
      </div>
      <p className="text-xs text-[var(--muted)]">Historical totals are calculated from LeagueZone's normalized provider seasons. Playoff bracket awards remain provider-capability dependent and are not inferred when a provider does not expose them.</p>
    </div>
  );
}
