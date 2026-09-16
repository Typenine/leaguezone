import MatchupDetailPage from '@/app/matchups/[week]/[id]/page';
import LeagueShareCardLink from '@/components/branding/LeagueShareCardLink';
import YahooMatchupDetail from '@/components/providers/YahooMatchupDetail';
import { getFantasyMatchupDetail } from '@/lib/server/provider-deep-data';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { resolveLeagueProviderSeason } from '@/lib/server/provider-seasons';

export const dynamic = 'force-dynamic';
export const revalidate = 20;

export default async function LeagueMatchupDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ leagueSlug: string; week: string; id: string }>;
  searchParams?: Promise<{ year?: string | string[] }>;
}) {
  const resolved = await params;
  const query: { year?: string | string[] } = searchParams ? await searchParams : {};
  const yearRaw = query.year;
  const year = Array.isArray(yearRaw) ? yearRaw[0] : yearRaw;
  const week = Number(resolved.week);
  const matchupId = Number(resolved.id);
  const league = await getLeagueBySlug(resolved.leagueSlug);
  const mapped = league ? await resolveLeagueProviderSeason(league.id, year).catch(() => null) : null;
  const detail = league && Number.isFinite(week) && Number.isFinite(matchupId)
    ? await getFantasyMatchupDetail(league.id, week, matchupId, mapped?.season).catch(() => null)
    : null;
  const labels = detail?.teams.slice(0, 2).map((side) => side.points > 0 ? `${side.team.teamName} · ${side.points.toFixed(2)}` : side.team.teamName) || [];

  if (league && mapped?.provider === 'yahoo' && Number.isFinite(week) && Number.isFinite(matchupId)) {
    return (
      <>
        <div className="container mx-auto flex justify-end px-4 pt-6"><LeagueShareCardLink leagueSlug={resolved.leagueSlug} type="matchup" title={`Week ${resolved.week} Matchup`} left={labels[0]} right={labels[1]} /></div>
        <YahooMatchupDetail leagueId={league.id} leagueSlug={league.slug} week={week} matchupId={matchupId} season={String(mapped.season)} />
      </>
    );
  }

  return (
    <>
      <div className="container mx-auto flex justify-end px-4 pt-6"><LeagueShareCardLink leagueSlug={resolved.leagueSlug} type="matchup" title={`Week ${resolved.week} Matchup`} left={labels[0]} right={labels[1]} /></div>
      <MatchupDetailPage params={params} />
    </>
  );
}
