'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function SetupCompletePage() {
  const router = useRouter();
  const [leagueName, setLeagueName] = useState('Your League');
  const [leagueSlug, setLeagueSlug] = useState<string | null>(null);

  useEffect(() => {
    async function loadLeague() {
      try {
        const res = await fetch('/api/setup/status', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data.leagueName === 'string' && data.leagueName) setLeagueName(data.leagueName);
        if (typeof data.leagueSlug === 'string' && data.leagueSlug) setLeagueSlug(data.leagueSlug);
      } catch {
        // The dashboard remains a safe fallback if league context cannot load.
      }
    }
    void loadLeague();
  }, []);

  const leagueHome = leagueSlug ? `/l/${leagueSlug}` : '/app';
  const commissionerSettings = leagueSlug ? `/l/${leagueSlug}/admin` : '/app';

  return (
    <div className="py-12 px-4 flex items-center justify-center min-h-screen">
      <div className="max-w-xl mx-auto text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/15 border border-green-500/30 text-green-400 mb-6">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M5 13l4 4L19 7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="block w-6 h-px bg-[var(--brand-gold)]" />
            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--brand-gold)]">Setup Complete</span>
            <span className="block w-6 h-px bg-[var(--brand-gold)]" />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white mb-2">
            You&apos;re live!
          </h1>
          <p className="text-white/55">{leagueName} is ready to go.</p>
        </div>

        <Card className="p-6 text-left">
          <h2 className="text-xs font-black uppercase tracking-[0.25em] text-[var(--brand-gold)] mb-4">Next Steps</h2>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-[var(--brand-gold)] text-[var(--brand-ink)] flex items-center justify-center text-xs font-black">1</span>
              <span className="text-[var(--muted)]">
                <strong className="text-[var(--text)]">Share invite links</strong> with league managers so they can claim their teams.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-[var(--brand-gold)] text-[var(--brand-ink)] flex items-center justify-center text-xs font-black">2</span>
              <span className="text-[var(--muted)]">
                <strong className="text-[var(--text)]">Open Commissioner Settings</strong> to adjust league features, branding, drafts, and content.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-[var(--brand-gold)] text-[var(--brand-ink)] flex items-center justify-center text-xs font-black">3</span>
              <span className="text-[var(--muted)]">
                <strong className="text-[var(--text)]">Review the league site</strong> before sending it to the rest of the league.
              </span>
            </li>
          </ul>
        </Card>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="secondary" onClick={() => router.push(commissionerSettings)}>
            Commissioner Settings
          </Button>
          <Button onClick={() => router.push(leagueHome)}>
            View League Site
          </Button>
        </div>
      </div>
    </div>
  );
}
