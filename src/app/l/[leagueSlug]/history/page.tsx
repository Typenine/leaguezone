import { Suspense } from 'react';
import HistoryContent from '@/app/history/HistoryContent';
import LeagueShareCardLink from '@/components/branding/LeagueShareCardLink';

export const dynamic = 'force-dynamic';

export default async function LeagueHistoryPage({ params }: { params: Promise<{ leagueSlug: string }> }) {
  const { leagueSlug } = await params;
  return (
    <>
      <div className="container mx-auto flex justify-end px-4 pt-6"><LeagueShareCardLink leagueSlug={leagueSlug} type="record" title="League Record Book" /></div>
      <Suspense fallback={<div className="container mx-auto px-4 py-8">Loading...</div>}>
        <HistoryContent />
      </Suspense>
    </>
  );
}
