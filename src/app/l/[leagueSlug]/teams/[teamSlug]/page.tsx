import { notFound, redirect } from 'next/navigation';
import { getCurrentLeagueBySlug } from '@/lib/server/league-context';

export const dynamic = 'force-dynamic';

export default async function LeagueTeamBridgePage({
  params,
}: {
  params: Promise<{ leagueSlug: string; teamSlug: string }>;
}) {
  const { leagueSlug, teamSlug } = await params;
  const league = await getCurrentLeagueBySlug(leagueSlug);
  if (!league) notFound();
  const target = `/teams/${encodeURIComponent(teamSlug)}`;
  redirect(`/api/league/select?id=${encodeURIComponent(league.id)}&next=${encodeURIComponent(target)}`);
}
