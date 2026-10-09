import type { Metadata } from 'next';
import Link from 'next/link';
import LeagueCard from '@/components/ui/LeagueCard';
import type { LeagueIconName } from '@/components/ui/LeagueIcon';
import { PLATFORM, PRODUCT_FEATURES, HOW_IT_WORKS } from '@/lib/config/platform';

export const metadata: Metadata = {
  title: 'League Websites | LeagueZone HQ',
  description: 'Build a branded fantasy league home with custom team pages, draft tools, trades, history, records, and commissioner features.',
};

export default function FeaturesPage() {
  return (
    <div className="bg-[var(--brand-ink)]">
      <section style={{ background: 'linear-gradient(155deg, var(--brand-navy), var(--brand-ink) 72%)' }} className="border-b border-white/10">
        <div className="container mx-auto max-w-7xl px-4 py-16 sm:py-20">
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[var(--brand-gold)]">League Websites</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black uppercase leading-none tracking-tighter text-white sm:text-6xl">
            Your league has a story. Give it a home.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/60">
            {PLATFORM.name} works alongside your fantasy provider. Keep the rosters and matchups you know, then add the history, identity, draft-night experience and tools that make your league yours.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/demo" className="inline-flex min-h-12 items-center justify-center rounded-md bg-[var(--brand-gold)] px-7 py-3 text-sm font-black uppercase tracking-wider text-[var(--brand-ink)] transition hover:brightness-110">
              Tour a Demo League
            </Link>
            <Link href="/register" className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/25 px-7 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-white/10">
              Create Your League
            </Link>
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-7xl px-4 py-16 sm:py-20">
        <div className="mb-8">
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[var(--brand-gold)]">League Tools</p>
          <h2 className="mt-3 text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">Everything that happens beyond the matchup.</h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-white/55">League identity, governance, draft nights, trades and history. Explore the tools available for connected league websites.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PRODUCT_FEATURES.map((feature) => (
            <LeagueCard
              key={feature.title}
              eyebrow={feature.eyebrow}
              title={feature.title}
              description={feature.description}
              icon={feature.icon as LeagueIconName}
            />
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#091728]">
        <div className="container mx-auto max-w-7xl px-4 py-14 sm:py-16">
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[var(--brand-gold)]">Getting Started</p>
          <h2 className="mt-3 text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">A home that grows with your league.</h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
                <span className="text-3xl font-black text-[var(--brand-gold)]">{item.step}</span>
                <h3 className="mt-4 text-sm font-black uppercase tracking-wide text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/55">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-7xl px-4 py-14 sm:py-16">
        <div className="flex flex-col gap-6 rounded-xl border border-[var(--brand-gold)]/30 bg-[var(--brand-gold)]/[0.05] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.23em] text-[var(--brand-gold)]">Also Part of LeagueZone</p>
            <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-white">Research the players behind your roster.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">Explore NFL statistics, player comparisons, opportunity changes and development trends, even if your league is not hosted on LeagueZone.</p>
          </div>
          <Link href="/research" className="inline-flex shrink-0 items-center justify-center rounded-md bg-[var(--brand-gold)] px-6 py-3 text-sm font-black uppercase tracking-wider text-[var(--brand-ink)] hover:brightness-110">
            Open Research
          </Link>
        </div>
      </section>
    </div>
  );
}
