import { notFound } from 'next/navigation';
import TransactionsPage from '@/app/transactions/page';
import { getLeagueBySlug } from '@/lib/server/league-context';

export const dynamic = 'force-dynamic';

export default async function LeagueTransactionsPage({ params, searchParams }: {
  params: Promise<{ leagueSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { leagueSlug } = await params;
  const league = await getLeagueBySlug(leagueSlug);
  if (!league) notFound();
  const query = await (searchParams || Promise.resolve({}));
  return <TransactionsPage searchParams={Promise.resolve({ ...query, _leagueId: league.id })} />;
}
