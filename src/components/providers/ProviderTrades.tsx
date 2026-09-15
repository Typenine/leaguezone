import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import SectionHeader from '@/components/ui/SectionHeader';
import { getFantasyTransactionsForSeason } from '@/lib/server/fantasy-data';
import { listLeagueProviderSeasons } from '@/lib/server/provider-seasons';

export default async function ProviderTrades({ leagueId }: { leagueId: string }) {
  const seasons = await listLeagueProviderSeasons(leagueId);
  const rows = (await Promise.all(seasons.map((season) => getFantasyTransactionsForSeason(leagueId, season.season).catch(() => []))))
    .flat()
    .filter((row) => row.type === 'trade')
    .sort((a, b) => b.created - a.created);
  return <main className="container mx-auto px-4 py-8"><SectionHeader title="Trades" subtitle="Imported provider trade history" /><div className="mt-6 space-y-4">{rows.length === 0 ? <Card><CardContent className="p-5 text-sm text-[var(--muted)]">No completed trades were returned by the configured provider.</CardContent></Card> : rows.map((trade) => <Card key={`${trade.season}-${trade.id}`}><CardHeader><CardTitle>{trade.season}{trade.week ? ` · Week ${trade.week}` : ''} · {trade.teamsInvolved.join(' ↔ ') || 'Trade'}</CardTitle></CardHeader><CardContent><div className="grid gap-4 md:grid-cols-2"><div><p className="mb-2 text-xs font-black uppercase tracking-wider text-[var(--muted)]">Assets received</p>{trade.added.length ? <ul className="space-y-1 text-sm">{trade.added.map((asset, index) => <li key={`${asset.playerId}-${index}`}>{asset.name || asset.playerId}</li>)}</ul> : <p className="text-sm text-[var(--muted)]">No imported assets</p>}</div><div><p className="mb-2 text-xs font-black uppercase tracking-wider text-[var(--muted)]">Assets sent</p>{trade.dropped.length ? <ul className="space-y-1 text-sm">{trade.dropped.map((asset, index) => <li key={`${asset.playerId}-${index}`}>{asset.name || asset.playerId}</li>)}</ul> : <p className="text-sm text-[var(--muted)]">No imported assets</p>}</div></div></CardContent></Card>)}</div></main>;
}
