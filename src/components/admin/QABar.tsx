'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type ActiveQa = {
  id: string;
  leagueName: string;
  perspective: string;
  teamName: string | null;
  mode: 'view' | 'rehearsal';
};

export default function QABar() {
  const [qa, setQa] = useState<ActiveQa | null>(null);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    fetch('/api/admin/qa', { cache: 'no-store', credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setQa(data.active || null))
      .catch(() => setQa(null));
  }, []);

  if (!qa) return null;
  const perspective = qa.perspective === 'team' || qa.perspective === 'member'
    ? qa.teamName || 'Member'
    : qa.perspective === 'commissioner' ? 'Commissioner' : 'Public Visitor';

  const end = async () => {
    setEnding(true);
    await fetch('/api/admin/qa', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'end' }),
    }).catch(() => null);
    window.location.assign('/admin/qa');
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[300] border-t border-amber-400/50 bg-[#17120a]/95 px-3 py-2 text-amber-50 shadow-2xl backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
        <div className="min-w-0">
          <span className="font-black tracking-wide text-amber-400">QA MODE</span>
          <span className="mx-2 text-amber-200/50">·</span>
          <span className="font-semibold">{qa.leagueName}</span>
          <span className="mx-2 text-amber-200/50">·</span>
          <span>{perspective}</span>
          <span className="mx-2 text-amber-200/50">·</span>
          <span className="uppercase text-amber-300">{qa.mode === 'rehearsal' ? 'Draft Rehearsal' : 'View Only'}</span>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href="/admin/qa" className="rounded-md border border-amber-400/40 px-2.5 py-1.5 font-semibold hover:bg-amber-400/10">Change View</Link>
          <button type="button" disabled={ending} onClick={end} className="rounded-md bg-amber-400 px-2.5 py-1.5 font-black text-black disabled:opacity-50">
            {ending ? 'Ending…' : 'Exit QA'}
          </button>
        </div>
      </div>
    </div>
  );
}
