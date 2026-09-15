import Link from 'next/link';
import TeamPage from '@/app/teams/[id]/page';
import ProviderTeamDetail from '@/components/providers/ProviderTeamDetail';
import { getLeagueBySlug } from '@/lib/server/league-context';
import { resolveLeagueProviderSeason } from '@/lib/server/provider-seasons';

export const dynamic = 'force-dynamic';

export default async function LeagueTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ leagueSlug: string; id: string }>;
  searchParams?: Promise<{ year?: string | string[] }>;
}) {
  const { leagueSlug, id } = await params;
  const query: { year?: string | string[] } = searchParams ? await searchParams : {};
  const yearRaw = query.year;
  const year = Array.isArray(yearRaw) ? yearRaw[0] : yearRaw;
  const league = await getLeagueBySlug(leagueSlug);
  const rosterId = Number(id);
  const mapped = league ? await resolveLeagueProviderSeason(league.id, year).catch(() => null) : null;

  if (league && mapped?.provider === 'yahoo' && Number.isFinite(rosterId)) {
    return <ProviderTeamDetail leagueId={league.id} leagueSlug={league.slug} rosterId={rosterId} season={String(mapped.season)} />;
  }

  return (
    <>
      {mapped?.provider === 'sleeper' && (
        <div className="container mx-auto flex justify-end px-4 pt-6">
          <Link href={`/l/${leagueSlug}/teams/${id}/health`} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-black text-[var(--on-accent,#fff)]">Team Health Center</Link>
        </div>
      )}
      <TeamPage />
    </>
  );
}
