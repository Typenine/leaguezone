import {
  getLeague,
  getLeagueMatchups,
  getLeagueRosters,
  getAllPlayersCached,
  getNFLState,
  getRosterIdToTeamNameMap,
  getTeamsData,
} from "@/lib/utils/sleeper-api";
import { getCountdownCards, getHomepagePhase } from "@/lib/utils/countdown-resolver";
import { buildLeagueCalendar } from "@/lib/constants/league-calendar";
import type { League } from "@/lib/server/league-context";
import type { TeamRow } from "@/types/trade-block";
import type { TradeAsset } from '@/types/trade-block';
import type { MyTeamData } from "@/components/home/MyTeamCard";
import type { StandingsTeam } from "@/components/home/PlayoffRacePanel";
import SeasonWeekHeader from "@/components/home/SeasonWeekHeader";
import HomepageCountdowns from "@/components/home/HomepageCountdowns";
import MyTeamCard from "@/components/home/MyTeamCard";
import SeasonMatchups, {
  type SeasonHomeMatchup,
  type SeasonProjectionStarter,
} from "@/components/home/SeasonMatchups";
import InSeasonStandings from "@/components/home/InSeasonStandings";
import PlayoffRacePanel from "@/components/home/PlayoffRacePanel";
import LeaguePulse from "@/components/home/LeaguePulse";
import WeeklyLeaders from "@/components/home/WeeklyLeaders";
import AroundTheLeague from "@/components/home/AroundTheLeague";
import RecentTransactions from "@/components/home/RecentTransactions";
import {
  buildLeagueProjectionSnapshotsV3,
} from "@/lib/fantasy/weekly-projections-next";
import { Suspense } from 'react';
import LeagueHistorySpotlight from '@/components/home/LeagueHistorySpotlight';
import { listLeagueUserDocs } from '@/server/db/queries.fixed';
import { loadTradeBlockLeagueContext, teamAssetsFromContext } from '@/lib/server/trade-assets';

export default async function SeasonLaunchHome({
  league,
  teamName,
  rosterId,
  searchParams,
}: {
  league: League;
  teamName?: string | null;
  rosterId?: number | null;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const now = new Date();
  const sleeperLeagueId = league.sleeperLeagueId || '';
  const sleeperLeague = sleeperLeagueId ? await getLeague(sleeperLeagueId).catch(() => null) : null;
  const seasonYear = String(sleeperLeague?.season || new Date().getUTCFullYear());
  const calendar = buildLeagueCalendar(league.config, Number(seasonYear));
  const presentationPhase = getHomepagePhase(now, calendar);
  const isPostDeadline = presentationPhase === "post_deadline_pre_postseason";
  const settings = (sleeperLeague?.settings || {}) as { playoff_week_start?: number; playoff_start_week?: number; playoff_teams?: number };
  const configuredWeeks = Number((league.config.season as Record<string, unknown> | undefined)?.regularSeasonWeeks || league.config.regularSeasonWeeks);
  const playoffStartWeek = Number(settings.playoff_week_start ?? settings.playoff_start_week ?? 15);
  const maxRegularWeeks = Number.isFinite(configuredWeeks)
    ? Math.max(1, Math.min(18, configuredWeeks))
    : Math.max(1, Math.min(18, playoffStartWeek - 1));

  const sp = (await (searchParams ?? Promise.resolve({}))) as Record<string, string | string[] | undefined>;
  const requestedRaw = sp.week;
  const requestedStr = Array.isArray(requestedRaw) ? requestedRaw[0] : requestedRaw;
  const requestedWeek = typeof requestedStr === "string" ? Number(requestedStr) : NaN;
  const hasWeekOverride = Number.isFinite(requestedWeek) && requestedWeek >= 1 && requestedWeek <= maxRegularWeeks;

  const leagueId = sleeperLeagueId;
  let selectedWeek = 1;
  let standings: StandingsTeam[] = [];
  const matchups: SeasonHomeMatchup[] = [];
  let myTeamData: MyTeamData | null = null;
  let tradeRows: TeamRow[] = [];
  let positionCounts: Record<string, Record<string, number>> = {};
  let playerPositions: Record<string, string> = {};

  try {
    const nflState = await getNFLState().catch(() => ({ week: 1, display_week: 1, season_has_scores: false }));
    const rawWeek = Number(
      (nflState as { week?: number; display_week?: number }).week
      ?? (nflState as { display_week?: number }).display_week
      ?? 1,
    );
    const currentWeek = Math.max(1, Math.min(18, Number.isFinite(rawWeek) ? rawWeek : 1));
    const beforeKickoff = now.getTime() < calendar.regularSeasonStart.getTime();
    const hasScores = (nflState as { season_has_scores?: boolean }).season_has_scores;
    let defaultWeek = beforeKickoff || hasScores === false ? 1 : currentWeek;
    const dowET = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/New_York" }).format(now);
    if (!beforeKickoff && (dowET === "Mon" || dowET === "Tue")) defaultWeek = Math.max(1, defaultWeek - 1);
    defaultWeek = Math.min(maxRegularWeeks, Math.max(1, defaultWeek));
    selectedWeek = hasWeekOverride ? requestedWeek : defaultWeek;

    const [teams, rosterNameMap, rosters, sleeperMatchups, players, tradeDocs, tradeContext] = await Promise.all([
      getTeamsData(leagueId).catch(() => []),
      getRosterIdToTeamNameMap(leagueId).catch(() => new Map<number, string>()),
      getLeagueRosters(leagueId).catch(() => []),
      getLeagueMatchups(leagueId, selectedWeek).catch(() => []),
      getAllPlayersCached().catch(() => ({})),
      listLeagueUserDocs(league.id).catch(() => []),
      loadTradeBlockLeagueContext(league.id).catch(() => null),
    ]);

    playerPositions = Object.fromEntries(Object.entries(players).map(([id, player]) => [id, String(player.position || '')]));
    positionCounts = Object.fromEntries(rosters.map((roster) => {
      const team = rosterNameMap.get(roster.roster_id) || `Roster ${roster.roster_id}`;
      const counts: Record<string, number> = {};
      for (const playerId of roster.players || []) {
        const position = playerPositions[playerId] || 'Other';
        counts[position] = (counts[position] || 0) + 1;
      }
      return [team, counts];
    }));

    tradeRows = tradeDocs.map((doc) => {
      const raw = Array.isArray(doc.tradeBlock) ? doc.tradeBlock as TradeAsset[] : [];
      let tradeBlock = raw;
      if (tradeContext) {
        const assets = teamAssetsFromContext(doc.team, tradeContext);
        const playersOwned = new Set(assets.players);
        tradeBlock = raw.filter((asset) => {
          if (asset.type === 'player') return playersOwned.has(asset.playerId);
          if (asset.type === 'pick') return assets.picks.some((pick) => pick.year === asset.year && pick.round === asset.round && pick.originalTeam === asset.originalTeam);
          if (asset.type === 'faab') return Number(asset.amount || 0) <= assets.faab;
          return false;
        });
      }
      return { team: doc.team, tradeBlock, tradeWants: doc.tradeWants || null, updatedAt: doc.updatedAt?.toISOString() || null };
    });

    const sortedTeams = [...teams].sort(
      (a, b) => (b.wins ?? 0) - (a.wins ?? 0) || (b.fpts ?? 0) - (a.fpts ?? 0),
    );
    standings = sortedTeams.map((team, index) => ({
      teamName: team.teamName,
      rosterId: team.rosterId,
      wins: team.wins ?? 0,
      losses: team.losses ?? 0,
      fpts: team.fpts ?? 0,
      seed: index + 1,
    }));

    let projectionSnapshots = await buildLeagueProjectionSnapshotsV3({
        season: seasonYear,
        week: selectedWeek,
        saveSnapshots: beforeKickoff ? selectedWeek === 1 : selectedWeek === currentWeek,
        dbLeagueId: league.id,
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

    const groups = new Map<number, Array<{ rosterId: number; points: number }>>();
    for (const matchup of sleeperMatchups) {
      const entries = groups.get(matchup.matchup_id) || [];
      entries.push({
        rosterId: matchup.roster_id,
        points: matchup.custom_points ?? matchup.points ?? 0,
      });
      groups.set(matchup.matchup_id, entries);
    }

    for (const [matchupId, entries] of groups.entries()) {
      if (entries.length < 2) continue;
      const [away, home] = entries;
      const homeTeam = rosterNameMap.get(home.rosterId) || `Roster ${home.rosterId}`;
      const awayTeam = rosterNameMap.get(away.rosterId) || `Roster ${away.rosterId}`;
      const homeSnapshot = projectionByTeam.get(homeTeam);
      const awaySnapshot = projectionByTeam.get(awayTeam);

      matchups.push({
        homeTeam,
        awayTeam,
        homeRosterId: home.rosterId,
        awayRosterId: away.rosterId,
        homeScore: home.points,
        awayScore: away.points,
        homeProjectedScore: homeSnapshot?.currentTotal ?? undefined,
        awayProjectedScore: awaySnapshot?.currentTotal ?? undefined,
        homeStarters: projectedStartersFor(homeTeam),
        awayStarters: projectedStartersFor(awayTeam),
        week: selectedWeek,
        matchupId,
      });
    }

    if (teamName) {
      const roster = rosters.find((item) => item.roster_id === rosterId || rosterNameMap.get(item.roster_id) === teamName);
      if (roster) {
        const teamStanding = standings.find((team) => team.rosterId === roster.roster_id);
        const uniquePlayers = new Set<string>(roster.players || []);
        for (const playerId of [...(roster.taxi || []), ...(roster.reserve || [])]) uniquePlayers.add(playerId);
        myTeamData = {
          teamName,
          rosterCount: uniquePlayers.size,
          taxiCount: (roster.taxi || []).length,
          irCount: (roster.reserve || []).length,
          wins: teamStanding?.wins ?? roster.settings?.wins ?? 0,
          losses: teamStanding?.losses ?? roster.settings?.losses ?? 0,
          fpts: teamStanding?.fpts ?? roster.settings?.fpts ?? 0,
          seed: teamStanding?.seed,
          tradeBlock: tradeRows.find((row) => row.team === teamName)?.tradeBlock || [],
          tradeWants: tradeRows.find((row) => row.team === teamName)?.tradeWants || null,
          tradeBlockUpdatedAt: tradeRows.find((row) => row.team === teamName)?.updatedAt || null,
          tradeBlockPlayerIds: (tradeRows.find((row) => row.team === teamName)?.tradeBlock || []).filter((asset) => asset.type === 'player').map((asset) => (asset as { playerId: string }).playerId),
          tradeBlockPickCount: (tradeRows.find((row) => row.team === teamName)?.tradeBlock || []).filter((asset) => asset.type === 'pick').length,
        };
      }
    }
  } catch {
    // Each section below has a useful empty/loading state.
  }

  return (
    <div className="home-page relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 home-aurora-motion"
        style={{
          background: `
            radial-gradient(1400px 760px at 7% -15%, rgba(37,99,235,0.38) 0%, rgba(37,99,235,0) 62%),
            radial-gradient(1200px 680px at 93% -8%, rgba(56,189,248,0.28) 0%, rgba(56,189,248,0) 64%),
            radial-gradient(1400px 980px at 50% 115%, rgba(99,102,241,0.24) 0%, rgba(99,102,241,0) 70%),
            linear-gradient(180deg, rgba(10,18,40,0.18) 0%, rgba(8,14,30,0.12) 45%, rgba(6,10,24,0.16) 100%)
          `,
          filter: "saturate(125%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.14]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.26) 1px, transparent 1px)",
          backgroundSize: "100% 4px",
        }}
      />

      <div className="container relative z-10 mx-auto px-4 py-6 sm:px-5 sm:py-8">
        <SeasonWeekHeader week={selectedWeek} matchupCount={matchups.length} season={seasonYear} scheduleHref={`/l/${league.slug}/matchups`} />

        <HomepageCountdowns cards={getCountdownCards(now, calendar)} />

        {myTeamData && (
          <section className="mb-10 sm:mb-12">
            <MyTeamCard data={myTeamData} phase={presentationPhase} basePath={`/l/${league.slug}`} />
          </section>
        )}

        <SeasonMatchups
          selectedWeek={selectedWeek}
          maxWeeks={maxRegularWeeks}
          season={seasonYear}
          matchups={matchups}
          scheduleHref={`/l/${league.slug}/matchups`}
          dashboardHref={`/l/${league.slug}/dashboard`}
          teamsBasePath={`/l/${league.slug}/teams`}
        />

        {isPostDeadline && standings.length > 0 ? (
          <PlayoffRacePanel standings={standings} playoffSpots={Math.max(2, Number(settings.playoff_teams ?? Math.ceil(standings.length / 2)))} basePath={`/l/${league.slug}`} />
        ) : (
          standings.length > 0 && <InSeasonStandings standings={standings} basePath={`/l/${league.slug}`} />
        )}

        <LeaguePulse
          tradeRows={tradeRows}
          positionCounts={positionCounts}
          playerPositions={playerPositions}
          phase={presentationPhase}
          standings={standings}
        />

        <WeeklyLeaders week={selectedWeek} matchups={matchups} />
        <AroundTheLeague myTeam={teamName ?? null} leagueSlug={league.slug} />
        <RecentTransactions leagueSlug={league.slug} season={seasonYear} />
        <Suspense fallback={null}><LeagueHistorySpotlight league={league} /></Suspense>
      </div>
    </div>
  );
}
