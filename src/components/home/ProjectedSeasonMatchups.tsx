import SeasonMatchups, {
  type SeasonHomeMatchup,
  type SeasonProjectionStarter,
} from '@/components/home/SeasonMatchups';
import { buildLeagueProjectionSnapshotsV3 } from '@/lib/fantasy/weekly-projections-next';

export default async function ProjectedSeasonMatchups({
  dbLeagueId,
  sleeperLeagueId,
  season,
  selectedWeek,
  maxWeeks,
  saveSnapshots,
  matchups,
  scheduleHref,
  dashboardHref,
  teamsBasePath,
}: {
  dbLeagueId: string;
  sleeperLeagueId: string;
  season: string;
  selectedWeek: number;
  maxWeeks: number;
  saveSnapshots: boolean;
  matchups: SeasonHomeMatchup[];
  scheduleHref: string;
  dashboardHref: string;
  teamsBasePath: string;
}) {
  if (!sleeperLeagueId || matchups.length === 0) {
    return (
      <SeasonMatchups
        selectedWeek={selectedWeek}
        maxWeeks={maxWeeks}
        season={season}
        sleeperLeagueId={sleeperLeagueId}
        matchups={matchups}
        scheduleHref={scheduleHref}
        dashboardHref={dashboardHref}
        teamsBasePath={teamsBasePath}
      />
    );
  }

  let projectionSnapshots = await buildLeagueProjectionSnapshotsV3({
    season,
    week: selectedWeek,
    saveSnapshots,
    dbLeagueId,
  }).catch(() => []);

  if (projectionSnapshots.length) {
    projectionSnapshots = projectionSnapshots.map((snapshot) => {
      const hasCurrentLineup = (snapshot.currentLineup || []).some((entry) => Boolean(entry.player));
      return {
        ...snapshot,
        currentTotal: snapshot.currentTotal ?? snapshot.optimalTotal,
        currentLineup: hasCurrentLineup ? snapshot.currentLineup : snapshot.optimalLineup,
      };
    });
  }

  const projectionByTeam = new Map(
    projectionSnapshots.map((snapshot) => [snapshot.teamName, snapshot] as const),
  );

  const projectedStartersFor = (teamName: string): SeasonProjectionStarter[] => {
    const snapshot = projectionByTeam.get(teamName);
    if (!snapshot) return [];
    return (snapshot.currentLineup || []).flatMap((entry) => {
      const player = entry.player;
      if (!player) return [];
      return [{
        id: player.id,
        position: player.position,
        nflTeam: player.nflTeam,
        projection: Number(player.projection || 0),
        stddev: Math.max(0.1, (Number(player.rangeHigh || 0) - Number(player.rangeLow || 0)) / 2.564),
      }];
    });
  };

  const projectedMatchups = matchups.map((matchup) => {
    const homeSnapshot = projectionByTeam.get(matchup.homeTeam);
    const awaySnapshot = projectionByTeam.get(matchup.awayTeam);
    return {
      ...matchup,
      homeProjectedScore: homeSnapshot?.currentTotal ?? undefined,
      awayProjectedScore: awaySnapshot?.currentTotal ?? undefined,
      homeStarters: projectedStartersFor(matchup.homeTeam),
      awayStarters: projectedStartersFor(matchup.awayTeam),
    };
  });

  return (
    <SeasonMatchups
      selectedWeek={selectedWeek}
      maxWeeks={maxWeeks}
      season={season}
      sleeperLeagueId={sleeperLeagueId}
      matchups={projectedMatchups}
      scheduleHref={scheduleHref}
      dashboardHref={dashboardHref}
      teamsBasePath={teamsBasePath}
    />
  );
}
