import Link from 'next/link';
import { notFound } from 'next/navigation';
import PlayoffScenarioLab, { type PlayoffLabGame, type PlayoffLabTeam } from '@/components/standings/PlayoffScenarioLab';
import SectionHeader from '@/components/ui/SectionHeader';
import { buildLeagueProjectionSnapshotsV3 } from '@/lib/fantasy/weekly-projections-next';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { getLeague as getSleeperLeague, getLeagueMatchups, getRosterIdToTeamNameMap, getTeamsData, type SleeperMatchup } from '@/lib/utils/sleeper-api';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export default async function LeaguePlayoffLabPage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  const dbLeague = await getLeagueBySlug(leagueSlug);
  if (!dbLeague?.sleeperLeagueId) notFound();
  const leagueId = dbLeague.sleeperLeagueId;
  const [teamsData, league, nameMap] = await Promise.all([
    getTeamsData(leagueId),
    getSleeperLeague(leagueId).catch(() => null),
    getRosterIdToTeamNameMap(leagueId).catch(() => new Map<number, string>()),
  ]);
  const settings = (league?.settings || {}) as { playoff_teams?: number; playoff_week_start?: number; playoff_start_week?: number };
  const playoffTeams = Math.max(2, Number(settings.playoff_teams ?? Math.ceil(teamsData.length / 2)));
  const regularSeasonEnd = clamp(Number(settings.playoff_week_start ?? settings.playoff_start_week ?? 15) - 1, 1, 17);
  const completedWeeks = teamsData.length ? clamp(Math.min(...teamsData.map((team) => team.wins + team.losses + team.ties)), 0, regularSeasonEnd) : 0;
  const startWeek = completedWeeks + 1;
  const history = await Promise.all(Array.from({ length: completedWeeks }, (_, index) => getLeagueMatchups(leagueId, index + 1).catch(() => [] as SleeperMatchup[])));
  const projections = startWeek <= regularSeasonEnd ? await buildLeagueProjectionSnapshotsV3({ season: String(league?.season || new Date().getUTCFullYear()), week: startWeek, saveSnapshots: false, dbLeagueId: dbLeague.id }).catch(() => []) : [];
  const projectionMap = new Map(projections.map((entry) => [entry.teamName, Number(entry.optimalTotal || 0)]));
  const scores = new Map<number, number[]>();
  history.flat().forEach((matchup) => {
    const value = Number(matchup.custom_points ?? matchup.points ?? 0);
    if (value > 0) scores.set(matchup.roster_id, [...(scores.get(matchup.roster_id) || []), value]);
  });
  const teams: PlayoffLabTeam[] = teamsData.map((team) => {
    const values = scores.get(team.rosterId) || [];
    const actualPpg = team.wins + team.losses + team.ties > 0 ? team.fpts / (team.wins + team.losses + team.ties) : 0;
    const ppg = actualPpg || projectionMap.get(team.teamName) || 125;
    const variance = values.length > 1 ? values.reduce((sum, value) => sum + Math.pow(value - ppg, 2), 0) / values.length : 324;
    return { rosterId: team.rosterId, teamName: team.teamName, wins: team.wins, losses: team.losses, ties: team.ties, pointsFor: team.fpts, ppg, scoreStdDev: clamp(Math.sqrt(variance), 10, 35) };
  });
  const remaining = await Promise.all(Array.from({ length: Math.max(0, regularSeasonEnd - startWeek + 1) }, (_, index) => ({ week: startWeek + index })).map(async ({ week }) => ({ week, rows: await getLeagueMatchups(leagueId, week).catch(() => [] as SleeperMatchup[]) })));
  const games: PlayoffLabGame[] = [];
  remaining.forEach(({ week, rows }) => {
    const grouped = new Map<number, SleeperMatchup[]>();
    rows.forEach((row) => grouped.set(row.matchup_id, [...(grouped.get(row.matchup_id) || []), row]));
    grouped.forEach((pair, matchupId) => {
      if (pair.length < 2) return;
      games.push({ id: `${week}-${matchupId}`, week, aRosterId: pair[0].roster_id, aTeam: nameMap.get(pair[0].roster_id) || `Roster ${pair[0].roster_id}`, bRosterId: pair[1].roster_id, bTeam: nameMap.get(pair[1].roster_id) || `Roster ${pair[1].roster_id}` });
    });
  });
  return <main className="container mx-auto px-4 py-8"><SectionHeader title="Playoff Scenario Lab" subtitle={`${league?.season || ''} playoff odds and remaining-schedule scenarios`} actions={<Link href={`/l/${dbLeague.slug}/standings`} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold">Back to standings</Link>} /><div className="mt-5"><PlayoffScenarioLab teams={teams} games={games} playoffTeams={playoffTeams} completedWeeks={completedWeeks} /></div></main>;
}
