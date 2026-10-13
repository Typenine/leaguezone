import type { Metadata } from 'next';
import Link from 'next/link';
import InstallAppActions from '@/components/pwa/InstallAppActions';

export const metadata: Metadata = {
  title: 'Get the LeagueZone App | LeagueZone HQ',
  description: 'Install LeagueZone on your phone or desktop to access fantasy football research and your leagues in one app.',
};

export default function InstallPage() {
  return (
    <div className="min-h-[70vh] bg-[var(--brand-ink)] text-white">
      <section className="border-b border-white/10" style={{ background: 'linear-gradient(155deg, var(--brand-navy), var(--brand-ink) 75%)' }}>
        <div className="container mx-auto max-w-5xl px-4 py-14 sm:py-20">
          <div className="flex flex-col gap-10 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--brand-gold)]">LeagueZone on your phone</p>
              <h1 className="mt-4 text-4xl font-black uppercase leading-none tracking-tighter sm:text-6xl">Your fantasy hub. One tap away.</h1>
              <p className="mt-5 text-base leading-8 text-white/65">Install LeagueZone like the East v. West app. It opens in its own window and brings player research and league tools together in one place.</p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pwa/icon-512.png" width="192" height="192" alt="LeagueZone app icon" className="h-36 w-36 rounded-3xl border border-white/15 shadow-2xl sm:h-44 sm:w-44" />
          </div>
        </div>
      </section>
      <section className="container mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <InstallAppActions />
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Link href="/research" className="rounded-xl border border-white/15 bg-white/[0.035] p-6 transition hover:border-[var(--brand-gold)]/50">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--brand-gold)]">Research</span>
            <h2 className="mt-3 text-xl font-black uppercase">Explore players and trends</h2>
            <p className="mt-2 text-sm leading-6 text-white/55">Stats, Opportunity Radar, receipts and development.</p>
          </Link>
          <Link href="/app" className="rounded-xl border border-white/15 bg-white/[0.035] p-6 transition hover:border-[var(--brand-gold)]/50">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--brand-gold)]">Leagues</span>
            <h2 className="mt-3 text-xl font-black uppercase">Open your leagues</h2>
            <p className="mt-2 text-sm leading-6 text-white/55">Team pages, draft nights, trades and league history.</p>
          </Link>
        </div>
      </section>
    </div>
  );
}
