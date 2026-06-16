'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { BarChart2, Trophy, Zap, ArrowLeftRight, Vote, Palette } from 'lucide-react';

const FEATURES = [
  {
    icon: BarChart2,
    title: 'Live Standings & Matchups',
    description: 'Real-time standings, weekly matchups, and head-to-head records synced directly from Sleeper.',
  },
  {
    icon: Trophy,
    title: 'League History',
    description: 'Track championships, playoff brackets, and historical records across all your seasons.',
  },
  {
    icon: Zap,
    title: 'Draft Hub',
    description: 'View past drafts, upcoming draft info, and live draft boards with pick tracking.',
  },
  {
    icon: ArrowLeftRight,
    title: 'Trade & Transaction Tracking',
    description: 'Complete transaction history with trade trees showing how assets moved through your league.',
  },
  {
    icon: Vote,
    title: 'League Suggestions',
    description: 'Democratic rule change proposals with voting and ballot tracking for your league constitution.',
  },
  {
    icon: Palette,
    title: 'Custom Branding',
    description: 'Personalize with your league colors, logo, team colors, and custom rules document.',
  },
];

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[var(--background)]">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/8 via-transparent to-transparent pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-6 py-20 sm:py-28">
          <div className="flex flex-col items-center text-center gap-6">
            <Image
              src="/assets/LeagueZone HQ Logo.png"
              alt="LeagueZone HQ"
              width={140}
              height={140}
              className="rounded-3xl shadow-xl"
              priority
            />
            <div className="space-y-3">
              <p className="text-xs font-bold tracking-widest uppercase text-[var(--accent)]">LeagueZone HQ</p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[var(--text)] leading-[1.05] tracking-tight">
                Your dynasty league<br />
                <span className="text-[var(--accent)]">deserves a real home.</span>
              </h1>
            </div>
            <p className="text-base sm:text-lg text-[var(--muted)] max-w-xl leading-relaxed">
              A branded headquarters for serious fantasy football leagues. Connects to Sleeper. Built for commissioners who care.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => router.push('/register')}
                className="px-8 py-3 rounded-full bg-[var(--accent)] text-white font-bold text-sm hover:opacity-90 transition-opacity"
              >
                Get started free
              </button>
              <button
                onClick={() => router.push('/demo')}
                className="px-8 py-3 rounded-full border border-[var(--border)] text-[var(--text)] font-bold text-sm hover:bg-[var(--surface-strong)] transition-colors"
              >
                View demo →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-black text-[var(--text)] mb-3">
              Everything your league needs
            </h2>
            <p className="text-[var(--muted)] text-sm">
              Built for dynasty. Syncs with Sleeper automatically.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/40 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center mb-4">
                    <Icon size={16} className="text-[var(--accent)]" />
                  </div>
                  <h3 className="text-sm font-bold text-[var(--text)] mb-1.5">{feature.title}</h3>
                  <p className="text-[var(--muted)] text-sm leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Sleeper callout ── */}
      <section className="py-16 px-6 bg-[var(--surface)] border-y border-[var(--border)]">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-8">
          <div className="flex-1">
            <p className="text-xs font-bold tracking-widest uppercase text-[var(--accent)] mb-2">Powered by Sleeper</p>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--text)] mb-3">No manual updates. Ever.</h2>
            <p className="text-[var(--muted)] text-sm leading-relaxed max-w-lg">
              Connect your Sleeper league once. Rosters, matchups, transactions, and standings stay in sync automatically.
            </p>
          </div>
          <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
            {['Real-time sync', 'No manual updates', 'Historical data', 'Multi-season'].map((tag) => (
              <span key={tag} className="px-3 py-1.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-semibold whitespace-nowrap">
                ✓ {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Setup steps ── */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-black text-[var(--text)] mb-3">Up and running in minutes</h2>
            <p className="text-[var(--muted)] text-sm">Three steps. No dev skills required.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { n: '01', title: 'Connect Sleeper', desc: "Enter your Sleeper league ID and we'll import your teams, rosters, and history automatically." },
              { n: '02', title: 'Customize branding', desc: 'Set your league name, colors, logo, and give every franchise its own identity.' },
              { n: '03', title: 'Invite your league', desc: 'Share invite links so managers can claim their teams and start using the site.' },
            ].map((step) => (
              <div key={step.n} className="flex gap-4">
                <span className="text-4xl font-black text-[var(--accent)]/20 leading-none mt-0.5 select-none tabular-nums">{step.n}</span>
                <div>
                  <h3 className="font-bold text-[var(--text)] mb-1.5 text-sm">{step.title}</h3>
                  <p className="text-sm text-[var(--muted)] leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <button
              onClick={() => router.push('/register')}
              className="px-8 py-3 rounded-full bg-[var(--accent)] text-white font-bold text-sm hover:opacity-90 transition-opacity"
            >
              Start setup wizard
            </button>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 px-6 bg-[var(--surface)] border-t border-[var(--border)]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-black text-[var(--text)] mb-3">
            Ready to build something your league will actually use?
          </h2>
          <p className="text-[var(--muted)] mb-8 text-sm">Free during beta. No credit card required.</p>
          <button
            onClick={() => router.push('/register')}
            className="px-10 py-3.5 rounded-full bg-[var(--accent)] text-white font-bold hover:opacity-90 transition-opacity"
          >
            Get LeagueZone HQ free
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 px-6 border-t border-[var(--border)]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[var(--muted)]">
          <div className="flex items-center gap-2.5">
            <Image src="/assets/LeagueZone HQ Logo.png" alt="" width={24} height={24} className="rounded" />
            <span className="font-bold text-[var(--text)]">LeagueZone HQ</span>
          </div>
          <p>Built for dynasty leagues. Powered by Sleeper.</p>
        </div>
      </footer>

    </div>
  );
}
