import Link from 'next/link';
import { notFound } from 'next/navigation';
import PlayoffScenarioLab, { type PlayoffLabGame, type PlayoffLabTeam } from '@/components/standings/PlayoffScenarioLab';
import SectionHeader from '@/components/ui/SectionHeader';
import { buildProviderLeagueProjectionSnapshots } from '@/lib/fantasy/provider-projections';
import { getFantasyMatchups, getFantasyStandings } from '@/lib/server/fantasy-data';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { getFantasyLeagueSettings } from '@/lib/server/provider-settings';
import { resolveLeagueProviderSeason } from '@/lib/server/provider-seasons';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export default async function LeaguePlayoffLabPage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  const dbLeague = await getLeagueBySlug(leagueSlug);
  if (!dbLeague) notFound();
  const mapped = await resolveLeagueProviderSeason(dbLeague.id).catch(() => null);
  if (!mapped) notFound();

  const [standingsData, settings] = await Promise.all([
    getFantasyStandings(dbLeague.id, mapped.season).catch(() => null),
    getFantasyLeagueSettings(dbLeague.id, mapped.season).catch(() => null),
  ]);
  const teamsData = standingsData?.teams || [];
  if (!teamsData.length) {
    return <main className="container mx-auto px-4 py-8"><SectionHeader title="Playoff Scenario Lab" /><p className="text-sm text-[var(--muted)]">Standings are not available yet for this league.</p></main>;
  }

  const playoffTeams = Math.max(2, settings?.playoffTeams ?? Math.ceil(teamsData.length / 2));
  const regularSeasonEnd = clamp(settings?.regularSeasonWeeks ?? ((settings?.playoffStartWeek || 15) - 1), 1, 17);
  const completedWeeks = clamp(Math.min(...teamsData.map((team) => team.wins + team.losses + team.ties)), 0, regularSeasonEnd);
  const startWeek = completedWeeks + 1;
  const history = await Promise.all(Array.from({ length: completedWeeks }, (_, index) => getFantasyMatchups(dbLeague.id, index + 1, mapped.season).catch(() => [])));
  const projections = startWeek <= regularSeasonEnd
    ? await buildProviderLeagueProjectionSnapshots({ leagueId: dbLeague.id, season: String(mapped.season), week: startWeek, saveSnapshots: false }).catch(() => [])
    : [];
  const projectionMap = new Map(projections.map((entry) => [entry.teamName, Number(entry.optimalTotal || entry.currentTotal || 0)]));
  const scores = new Map<number, number[]>();
  history.flat().forEach((matchup) => matchup.teams.forEach((side) => {
    const value = Number(side.points || 0);
    if (value > 0) scores.set(side.rosterId, [...(scores.get(side.rosterId) || []), value]);
  }));

  const teams: PlayoffLabTeam[] = teamsData.map((team) => {
    const values = scores.get(team.rosterId) || [];
    const games = team.wins + team.losses + team.ties;
    const actualPpg = games > 0 ? team.fpts / games : 0;
    const ppg = actualPpg || projectionMap.get(team.teamName) || 0;
    const fallbackVariance = ppg > 0 ? Math.pow(Math.max(10, ppg * 0.14), 2) : 324;
    const variance = values.length > 1 ? values.reduce((sum, value) => sum + Math.pow(value - ppg, 2), 0) / values.length : fallbackVariance;
    return { rosterId: team.rosterId, teamName: team.teamName, wins: team.wins, losses: team.losses, ties: team.ties, pointsFor: team.fpts, ppg, scoreStdDev: clamp(Math.sqrt(variance), 10, 35) };
  });

  const remaining = await Promise.all(Array.from({ length: Math.max(0, regularSeasonEnd - startWeek + 1) }, (_, index) => startWeek + index).map(async (week) => ({ week, rows: await getFantasyMatchups(dbLeague.id, week, mapped.season).catch(() => []) })));
  const games: PlayoffLabGame[] = [];
  remaining.forEach(({ week, rows }) => rows.forEach((matchup) => {
    if (matchup.teams.length < 2) return;
    const [a, b] = matchup.teams;
    games.push({ id: `${week}-${matchup.matchupId}`, week, aRosterId: a.rosterId, aTeam: a.teamName, bRosterId: b.rosterId, bTeam: b.teamName });
  }));

  return <main className="container mx-auto px-4 py-8"><SectionHeader title="Playoff Scenario Lab" subtitle={`${mapped.season} playoff odds and remaining-schedule scenarios · ${mapped.provider === 'yahoo' ? 'Yahoo Fantasy' : 'Sleeper'} data`} actions={<Link href={`/l/${dbLeague.slug}/standings`} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold">Back to standings</Link>} /><div className="mt-5"><PlayoffScenarioLab teams={teams} games={games} playoffTeams={playoffTeams} completedWeeks={completedWeeks} /></div></main>;
}
