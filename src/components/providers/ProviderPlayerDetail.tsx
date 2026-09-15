import Link from 'next/link';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import SectionHeader from '@/components/ui/SectionHeader';
import { getFantasyPlayerDetail } from '@/lib/server/provider-deep-data';

export default async function ProviderPlayerDetail({ leagueId, leagueSlug, playerId }: { leagueId: string; leagueSlug: string; playerId: string }) {
  const detail = await getFantasyPlayerDetail(leagueId, playerId).catch(() => null);
  if (!detail) return <div className="container mx-auto px-4 py-8"><SectionHeader title="Player not found" /><p className="text-[var(--muted)]">This player is not present in the league's imported provider seasons.</p></div>;
  return <main className="container mx-auto space-y-6 px-4 py-8"><SectionHeader title={detail.player.fullName} subtitle={[detail.player.position, detail.player.nflTeam].filter(Boolean).join(' · ')} /><Card><CardHeader><CardTitle>League history</CardTitle></CardHeader><CardContent>{detail.seasons.length ? <div className="divide-y divide-[var(--border)]">{detail.seasons.map((row) => <div key={`${row.season}-${row.rosterId}`} className="flex items-center justify-between gap-4 py-3"><div><p className="font-semibold">{row.season} · {row.provider === 'yahoo' ? 'Yahoo Fantasy' : 'Sleeper'}</p><p className="text-sm text-[var(--muted)]">{row.teamName}</p></div><Link href={`/l/${leagueSlug}/teams/${row.rosterId}?year=${row.season}`} className="text-sm font-bold text-[var(--accent)]">Team page</Link></div>)}</div> : <p className="text-sm text-[var(--muted)]">No historical roster appearances are available.</p>}</CardContent></Card><p className="text-xs text-[var(--muted)]">LeagueZone player ID: {detail.leaguePlayerId || 'pending identity sync'} · Provider ID: {detail.player.providerPlayerId}</p></main>;
}
