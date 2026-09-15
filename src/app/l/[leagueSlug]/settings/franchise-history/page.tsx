import { notFound } from 'next/navigation';
import FranchiseHistoryManager from '@/components/providers/FranchiseHistoryManager';
import { getLeagueBySlug } from '@/lib/server/league-context';

export const dynamic = 'force-dynamic';

export default async function FranchiseHistorySettingsPage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) notFound();
  return <FranchiseHistoryManager leagueId={league.id} />;
}
