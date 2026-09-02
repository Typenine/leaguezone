import FranchisePage from '@/app/history/franchises/[id]/page';
export const dynamic = 'force-dynamic';
export default async function ScopedFranchisePage({ params }: { params: Promise<{ leagueSlug: string; id: string }> }) {
  const values = await params;
  return FranchisePage({ params: Promise.resolve({ id: values.id }), searchParams: Promise.resolve({ _league: values.leagueSlug }) });
}
