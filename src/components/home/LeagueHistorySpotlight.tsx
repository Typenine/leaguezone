import type { League } from '@/lib/server/league-context';
import { getLeagueIdsFromDb } from '@/lib/server/league-config';
import { getHeadToHeadAllTime } from '@/lib/utils/headtohead';
import HistoricalSpotlight from './HistoricalSpotlight';

export default async function LeagueHistorySpotlight({ league }: { league: League }) {
  const leagueIds = await getLeagueIdsFromDb(league.id);
  const h2h = leagueIds.current
    ? await getHeadToHeadAllTime(undefined, leagueIds).catch(() => ({ teams: [], matrix: {}, neverBeaten: [] }))
    : { teams: [], matrix: {}, neverBeaten: [] };
  return <HistoricalSpotlight h2h={h2h} historyHref={`/l/${league.slug}/history`} />;
}
