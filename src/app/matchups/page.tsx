import Link from 'next/link';
import { cookies } from 'next/headers';
import { getLeagueIdsFromDb } from '@/lib/server/league-config';
import { getNFLState, getLeagueMatchups, getRosterIdToTeamNameMap } from '@/lib/utils/sleeper-api';
import type { SleeperMatchup } from '@/lib/utils/sleeper-api';

export const dynamic = 'force-dynamic';

type MatchupPair = {
  matchupId: number;
  teams: Array<{
    rosterId: number;
    teamName: string;
    points: number;
  }>;
};

function groupMatchups(
  matchups: SleeperMatchup[],
  rosterMap: Map<number, string>
): MatchupPair[] {
  const byMatchup = new Map<number, SleeperMatchup[]>();
  for (const m of matchups) {
    if (!m.matchup_id) continue;
    const arr = byMatchup.get(m.matchup_id) ?? [];
    arr.push(m);
    byMatchup.set(m.matchup_id, arr);
  }
  const pairs: MatchupPair[] = [];
  for (const [matchupId, group] of byMatchup.entries()) {
    pairs.push({
      matchupId,
      teams: group.map((m) => ({
        rosterId: m.roster_id,
        teamName: rosterMap.get(m.roster_id) ?? `Roster ${m.roster_id}`,
        points: m.points ?? 0,
      })),
    });
  }
  return pairs.sort((a, b) => a.matchupId - b.matchupId);
}

export default async function MatchupsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const cookieJar = await cookies();
  const activeLeagueId = cookieJar.get('active_league_id')?.value || undefined;

  const params = await searchParams;
  const weekParam = typeof params.week === 'string' ? parseInt(params.week, 10) : NaN;

  // Fetch league config and NFL state concurrently
  const [leagueConfig, nflState] = await Promise.allSettled([
    getLeagueIdsFromDb(activeLeagueId),
    getNFLState(),
  ]);

  const currentLeagueId =
    leagueConfig.status === 'fulfilled' ? leagueConfig.value.current : '';

  const nflWeek =
    nflState.status === 'fulfilled'
      ? nflState.value.week ?? 1
      : 1;

  const selectedWeek = Number.isFinite(weekParam) && weekParam >= 1 && weekParam <= 17
    ? weekParam
    : nflWeek;

  const WEEKS = Array.from({ length: 17 }, (_, i) => i + 1);

  let matchupPairs: MatchupPair[] = [];
  let loadError = '';

  if (currentLeagueId) {
    try {
      const [rawMatchups, rosterMap] = await Promise.all([
        getLeagueMatchups(currentLeagueId, selectedWeek),
        getRosterIdToTeamNameMap(currentLeagueId),
      ]);
      matchupPairs = groupMatchups(rawMatchups, rosterMap);
    } catch {
      loadError = 'Could not load matchup data at this time.';
    }
  } else {
    loadError = 'League not configured.';
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--text)]">Matchups</h1>
        <p className="text-[var(--muted)] mt-1">Weekly head-to-head results</p>
      </div>

      {/* Week selector */}
      <div className="flex flex-wrap gap-2 mb-8">
        {WEEKS.map((w) => (
          <Link
            key={w}
            href={`/matchups?week=${w}`}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all border"
            style={
              w === selectedWeek
                ? {
                    backgroundColor: 'var(--accent)',
                    color: '#fff',
                    borderColor: 'var(--accent)',
                  }
                : {
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text)',
                    borderColor: 'var(--border)',
                  }
            }
          >
            Wk {w}
          </Link>
        ))}
      </div>

      {/* Matchups */}
      {loadError ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
          <p className="text-[var(--muted)]">{loadError}</p>
        </div>
      ) : matchupPairs.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
          <p className="text-[var(--muted)]">No matchup data for Week {selectedWeek}.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {matchupPairs.map((pair) => {
            const [teamA, teamB] = pair.teams;
            if (!teamA || !teamB) return null;

            const hasScores = teamA.points > 0 || teamB.points > 0;
            const winner = hasScores
              ? teamA.points > teamB.points
                ? 'a'
                : teamB.points > teamA.points
                ? 'b'
                : 'tie'
              : null;

            return (
              <Link
                key={pair.matchupId}
                href={`/matchups/${selectedWeek}/${pair.matchupId}`}
                className="group rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/60 transition-all overflow-hidden"
              >
                <div className="p-4 space-y-2">
                  {/* Team A */}
                  <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${winner === 'a' ? 'bg-[var(--accent)]/10' : 'bg-transparent'}`}>
                    <span className={`text-sm font-medium truncate ${winner === 'a' ? 'text-[var(--accent)] font-semibold' : 'text-[var(--text)]'}`}>
                      {teamA.teamName}
                    </span>
                    {hasScores && (
                      <span className={`text-sm font-bold ml-2 flex-shrink-0 ${winner === 'a' ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}>
                        {teamA.points.toFixed(2)}
                      </span>
                    )}
                  </div>

                  {/* VS divider */}
                  <div className="text-center text-xs text-[var(--muted)] font-medium">vs</div>

                  {/* Team B */}
                  <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${winner === 'b' ? 'bg-[var(--accent)]/10' : 'bg-transparent'}`}>
                    <span className={`text-sm font-medium truncate ${winner === 'b' ? 'text-[var(--accent)] font-semibold' : 'text-[var(--text)]'}`}>
                      {teamB.teamName}
                    </span>
                    {hasScores && (
                      <span className={`text-sm font-bold ml-2 flex-shrink-0 ${winner === 'b' ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}>
                        {teamB.points.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t border-[var(--border)] flex items-center justify-between">
                  <span className="text-xs text-[var(--muted)]">Week {selectedWeek}</span>
                  <span className="text-xs font-medium text-[var(--accent)] group-hover:underline">
                    View →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
