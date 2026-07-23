import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import NewsletterContent from './NewsletterContent';
import { PLATFORM_FEATURES } from '@/lib/config/features';

export const metadata: Metadata = {
  title: 'Newsletter • Fantasy Football League',
  description: 'League newsletters, weekly recaps, and podcast.',
};

export default function NewsletterPage() {
  if (!PLATFORM_FEATURES.newsletter) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--accent)]">Feature status</p>
          <h1 className="mt-3 text-3xl font-black uppercase tracking-tight text-[var(--text)]">Newsletter is dormant</h1>
          <p className="mx-auto mt-4 max-w-xl text-[var(--muted)]">
            Existing newsletter records and uploaded files have been preserved, but new issues, uploads, publishing, and newsletter API access are currently disabled.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/home"
              className="inline-flex items-center justify-center rounded-md bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-[var(--on-brand)] hover:opacity-90"
            >
              Return to league home
            </Link>
            <Link
              href="/app"
              className="inline-flex items-center justify-center rounded-md border border-[var(--border)] px-5 py-2.5 text-sm font-bold text-[var(--text)] hover:bg-[var(--surface-strong)]"
            >
              View all leagues
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-8">Loading...</div>}>
      <NewsletterContent />
    </Suspense>
  );
}
