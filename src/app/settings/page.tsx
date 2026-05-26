import { Suspense } from 'react';
import type { Metadata } from 'next';
import SettingsContent from './SettingsContent';

export const metadata: Metadata = {
  title: 'Settings',
};

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-8 text-[var(--muted)]">Loading…</div>}>
      <SettingsContent />
    </Suspense>
  );
}
