'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export default function LeagueAdvancedPanel({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="mb-8 sm:mb-10" aria-label="League analytics">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-left text-[var(--text)] transition hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:px-5"
      >
        <span>
          <span className="block text-base font-black">League analytics & deep dives</span>
          <span className="mt-1 block text-sm text-[var(--muted)]">Team comparisons, trade-market trends and advanced league numbers.</span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && <div className="pt-4">{children}</div>}
    </section>
  );
}
