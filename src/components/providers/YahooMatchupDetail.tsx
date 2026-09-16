import Link from 'next/link';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import SectionHeader from '@/components/ui/SectionHeader';
import { getYahooScoredMatchupDetail } from '@/lib/server/provider-matchup-scoring';

export default async function YahooMatchupDetail({ leagueId, leagueSlug, week, matchupId, season }: {
  leagueId: string;
  leagueSlug: string;
  week: number;
  matchupId: number;
  season?: string | null;
}) {
  const detail = await getYahooScoredMatchupDetail(leagueId, week, matchupId, season).catch(() => null);
  if (!detail) {
    return <div className="container mx-auto px-4 py-8"><SectionHeader title={`Week ${week} Matchup`} /><p className="text-[var(--muted)]">Matchup data is not available.</p></div>;
  }
  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <SectionHeader title={`Week ${week} Matchup`} actions={<Link href={`/l/${leagueSlug}/matchups?week=${week}&year=${detail.season}`} className="text-sm font-bold text-[var(--accent)]">Back to week {week}</Link>} />
      <div className="grid gap-5 md:grid-cols-2">
        {detail.teams.map((side) => (
          <Card key={side.team.providerTeamId}>
            <CardHeader><CardTitle><Link href={`/l/${leagueSlug}/teams/${side.team.rosterId}?year=${detail.season}`} className="hover:text-[var(--accent)]">{side.team.teamName}</Link></CardTitle></CardHeader>
            <CardContent>
              <p className="mb-4 text-4xl font-black">{side.points.toFixed(2)}</p>
              {side.playerScoringAvailable ? (
                <>
                  <div className="mb-2 text-xs font-black uppercase tracking-wider text-[var(--muted)]">Starters</div>
                  <div className="space-y-2">
                    {side.starters.map((player) => (
                      <div key={player.playerId} className="flex justify-between gap-3 border-t border-[var(--border)] pt-2 text-sm">
                        <Link href={`/l/${leagueSlug}/players/${encodeURIComponent(player.playerId)}`} className="font-semibold hover:text-[var(--accent)]">{player.fullName}</Link>
                        <span>{player.points == null ? '—' : player.points.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  {side.bench.length > 0 && <details className="mt-4"><summary className="cursor-pointer text-xs font-bold text-[var(--muted)]">Bench ({side.bench.length})</summary><div className="mt-2 space-y-2">{side.bench.map((player) => <div key={player.playerId} className="flex justify-between gap-3 text-xs text-[var(--muted)]"><span>{player.fullName}</span><span>{player.points == null ? '—' : player.points.toFixed(2)}</span></div>)}</div></details>}
                </>
              ) : (
                <p className="text-sm text-[var(--muted)]">Yahoo returned the team score, but individual weekly player scoring was not available for this matchup. LeagueZone will not infer player totals.</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-[var(--muted)]">Provider: Yahoo Fantasy · Season {detail.season}</p>
    </div>
  );
}
