'use client';

import Link from 'next/link';
import CountdownTimer from '@/components/ui/countdown-timer';
import { NEXT_DRAFT_ROOM_DATE } from '@/lib/draft/access';

export default function DraftRoomClosed() {
  const runtimeWindow = typeof window !== 'undefined' ? window as typeof window & { __LEAGUE_BRANDING__?: { name?: string } } : null;
  const leagueName = runtimeWindow?.__LEAGUE_BRANDING__?.name || 'League';
  const draftDate = NEXT_DRAFT_ROOM_DATE;
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: 'linear-gradient(135deg, #be161e18 0%, #bf994418 100%), #0a0a0e' }}
    >
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <div className="text-xs font-bold uppercase tracking-[0.28em] text-zinc-500 mb-3">
            {leagueName} Draft Room
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-3">No Active Draft</h1>
          <p className="text-zinc-400 text-base sm:text-lg max-w-2xl mx-auto">
            There is no active draft. The room will reopen when your commissioner starts the next rookie draft.
          </p>
        </div>

        <CountdownTimer
          targetDate={NEXT_DRAFT_ROOM_DATE}
          title="Countdown to the next rookie draft"
          emphasis
        />

        <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/70 px-5 py-4 text-center">
          <div className="text-white font-bold">{draftDate.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })}</div>
        </div>

        <div className="mt-7 text-center">
          <Link
            href="/draft"
            className="inline-flex items-center justify-center rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
          >
            Back to Draft Central
          </Link>
        </div>
      </div>
    </div>
  );
}
