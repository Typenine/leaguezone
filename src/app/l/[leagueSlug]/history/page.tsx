import { Suspense } from 'react';
import HistoryContent from '@/app/history/HistoryContent';

export const dynamic = 'force-dynamic';

export default function LeagueHistoryPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-8">Loading...</div>}>
      <HistoryContent />
    </Suspense>
  );
}
