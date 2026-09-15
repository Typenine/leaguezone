import Link from 'next/link';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import SectionHeader from '@/components/ui/SectionHeader';
import { providerFeatureMessage } from '@/lib/providers/capabilities';
import { getFantasyMatchupDetail } from '@/lib/server/provider-deep-data';

export default async function ProviderMatchupDetail({ leagueId, leagueSlug, week, matchupId, season }: { leagueId: string; leagueSlug: string; week: number; matchupId: number; season?: string | null }) {
  const detail = await getFantasyMatchupDetail(leagueId, week, matchupId, season).catch(() => null);
  if (!detail) return <div className="container mx-auto px-4 py-8"><SectionHeader title={`Week ${week} Matchup`} /><p className="text-[var(--muted)]">Matchup data is not available.</p></div>;
  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <SectionHeader title={`Week ${week} Matchup`} actions={<Link href={`/l/${leagueSlug}/matchups?week=${week}&year=${detail.season}`} className="text-sm font-bold text-[var(--accent)]">Back to week {week}</Link>} />
      <div className="grid gap-5 md:grid-cols-2">
        {detail.teams.map((side) => <Card key={side.team.providerTeamId}><CardHeader><CardTitle><Link href={`/l/${leagueSlug}/teams/${side.team.rosterId}?year=${detail.season}`} className="hover:text-[var(--accent)]">{side.team.teamName}</Link></CardTitle></CardHeader><CardContent><p className="mb-4 text-4xl font-black">{side.points.toFixed(2)}</p>{detail.capabilities.matchupPlayerScoring ? <div className="space-y-2">{side.starters.map((player) => <div key={player.playerId} className="flex justify-between gap-3 border-t border-[var(--border)] pt-2 text-sm"><Link href={`/l/${leagueSlug}/players/${encodeURIComponent(player.playerId)}`} className="font-semibold hover:text-[var(--accent)]">{player.fullName}</Link><span>{player.points == null ? '—' : player.points.toFixed(2)}</span></div>)}</div> : <p className="text-sm text-[var(--muted)]">{providerFeatureMessage(detail.provider, 'matchupPlayerScoring')}</p>}</CardContent></Card>)}
      </div>
      <p className="text-xs text-[var(--muted)]">Provider: {detail.provider === 'yahoo' ? 'Yahoo Fantasy' : 'Sleeper'} · Season {detail.season}</p>
    </div>
  );
}
