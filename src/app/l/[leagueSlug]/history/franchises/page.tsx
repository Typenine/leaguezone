import FranchisesPage from '@/app/history/franchises/page';
export const dynamic = 'force-dynamic';
export default async function ScopedFranchisesPage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  return FranchisesPage({ searchParams: Promise.resolve({ _league: leagueSlug }) });
}
