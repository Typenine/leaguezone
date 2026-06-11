import { Suspense } from 'react';
import type { Metadata } from 'next';
import NewsletterContent from './NewsletterContent';

export const metadata: Metadata = {
  title: 'Newsletter • Fantasy Football League',
  description: 'League newsletters, weekly recaps, and podcast.',
};

export default function NewsletterPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-8">Loading...</div>}>
      <NewsletterContent />
    </Suspense>
  );
}
