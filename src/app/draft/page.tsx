import { Suspense } from 'react';
import DraftHubContent from './DraftHubContent';

export default function DraftPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-8">Loading...</div>}>
      <DraftHubContent />
    </Suspense>
  );
}
