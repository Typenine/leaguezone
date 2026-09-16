import Link from 'next/link';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import SectionHeader from '@/components/ui/SectionHeader';
import { getFantasyTeamDetail } from '@/lib/server/provider-deep-data';

export default async function ProviderTeamDetail({ leagueId, leagueSlug, rosterId, season }: { leagueId: string; leagueSlug: string; rosterId: number; season?: string | null }) {
  const detail = await getFantasyTeamDetail(leagueId, rosterId, season).catch(() => null);
  if (!detail) return <div className="container mx-auto px-4 py-8"><SectionHeader title="Team not found" /><p className="text-[var(--muted)]">LeagueZone could not load this team from the configured fantasy provider.</p></div>;
  const record = `${detail.team.wins}-${detail.team.losses}${detail.team.ties ? `-${detail.team.ties}` : ''}`;
  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <SectionHeader title={detail.team.teamName} subtitle={`${detail.season} · ${detail.provider === 'yahoo' ? 'Yahoo Fantasy' : 'Sleeper'} · ${record}`} actions={<Link href={`/l/${leagueSlug}/teams/${rosterId}/health`} className="rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-black text-[var(--on-accent,#fff)]">Team Health Center</Link>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5"><p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Record</p><p className="mt-1 text-3xl font-black">{record}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Points For</p><p className="mt-1 text-3xl font-black">{detail.team.fpts.toFixed(2)}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Points Against</p><p className="mt-1 text-3xl font-black">{detail.team.fptsAgainst.toFixed(2)}</p></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Roster</CardTitle></CardHeader><CardContent>{detail.players.length === 0 ? <p className="text-sm text-[var(--muted)]">No roster data is available.</p> : <div className="divide-y divide-[var(--border)]">{detail.players.sort((a, b) => (a.position || '').localeCompare(b.position || '') || a.fullName.localeCompare(b.fullName)).map((player) => <Link key={player.playerId} href={`/l/${leagueSlug}/players/${encodeURIComponent(player.playerId)}`} className="flex items-center justify-between gap-4 py-3 hover:text-[var(--accent)]"><span className="font-semibold">{player.fullName}</span><span className="text-sm text-[var(--muted)]">{[player.position, player.nflTeam].filter(Boolean).join(' · ') || 'Player'}</span></Link>)}</div>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Season Schedule</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr className="border-b border-[var(--border)] text-left text-[var(--muted)]"><th className="py-2">Week</th><th>Opponent</th><th>Score</th><th>Result</th></tr></thead><tbody>{detail.schedule.map((row) => <tr key={row.week} className="border-b border-[var(--border)]/60"><td className="py-2">{row.week}</td><td><Link href={`/l/${leagueSlug}/teams/${row.opponentRosterId}?year=${detail.season}`} className="font-semibold hover:text-[var(--accent)]">{row.opponentName}</Link></td><td>{row.points.toFixed(2)} - {row.opponentPoints.toFixed(2)}</td><td>{row.result || 'Scheduled'}</td></tr>)}</tbody></table></CardContent></Card>
    </div>
  );
}
