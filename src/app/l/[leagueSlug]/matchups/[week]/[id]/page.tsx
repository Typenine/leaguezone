import MatchupDetailPage from '@/app/matchups/[week]/[id]/page';
import LeagueShareCardLink from '@/components/branding/LeagueShareCardLink';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { getLeagueMatchups, getRosterIdToTeamNameMap } from '@/lib/utils/sleeper-api';

export const dynamic = 'force-dynamic';
export const revalidate = 20;

export default async function LeagueMatchupDetailPage({ params }: { params: Promise<{ leagueSlug: string; week: string; id: string }> }) {
  const resolved = await params;
  const week = Number(resolved.week);
  const matchupId = Number(resolved.id);
  const league = await getLeagueBySlug(resolved.leagueSlug);
  let left: string | undefined;
  let right: string | undefined;

  if (league?.sleeperLeagueId && Number.isFinite(week) && Number.isFinite(matchupId)) {
    const [rows, names] = await Promise.all([
      getLeagueMatchups(league.sleeperLeagueId, week).catch(() => []),
      getRosterIdToTeamNameMap(league.sleeperLeagueId).catch(() => new Map<number, string>()),
    ]);
    const pair = rows.filter((row) => Number(row.matchup_id) === matchupId).slice(0, 2);
    const detail = pair.map((row) => {
      const team = names.get(row.roster_id) || `Roster ${row.roster_id}`;
      const points = Number(row.points || 0);
      return points > 0 ? `${team} · ${points.toFixed(2)}` : team;
    });
    [left, right] = detail;
  }

  return <><div className="container mx-auto flex justify-end px-4 pt-6"><LeagueShareCardLink leagueSlug={resolved.leagueSlug} type="matchup" title={`Week ${resolved.week} Matchup`} left={left} right={right} /></div><MatchupDetailPage params={params} /></>;
}
