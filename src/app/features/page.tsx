import type { Metadata } from 'next';
import Link from 'next/link';
import LeagueCard from '@/components/ui/LeagueCard';
import type { LeagueIconName } from '@/components/ui/LeagueIcon';
import { PLATFORM, PRODUCT_FEATURES, HOW_IT_WORKS } from '@/lib/config/platform';

export const metadata: Metadata = {
  title: `Features — ${PLATFORM.name}`,
  description: PLATFORM.description,
};

export default function FeaturesPage() {
  return (
    <div style={{ background: 'var(--brand-ink)' }}>
      <section style={{ background: 'linear-gradient(160deg, var(--brand-navy) 0%, var(--brand-ink) 65%)' }} className="border-b border-white/10">
        <div className="container mx-auto px-4 py-16 sm:py-20">
          <div className="flex items-center gap-3 mb-3">
            <span className="block w-6 h-px bg-[var(--brand-gold)]" />
            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--brand-gold)]">Features</span>
          </div>
          <h1 className="mt-2 max-w-3xl text-4xl font-black uppercase leading-none tracking-tighter text-white sm:text-6xl">
            Everything Sleeper doesn&apos;t do, in one league headquarters.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/60">
            {PLATFORM.name} works alongside your Sleeper league. Rosters and scores stay where they are —
            your identity, rules, history, and league culture get a real home.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/demo"
              className="inline-flex items-center justify-center bg-[var(--brand-gold)] text-[var(--brand-ink)] px-7 py-3 text-sm font-black uppercase tracking-widest transition hover:brightness-110"
            >
              View Demo League
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center border border-white/25 text-white px-7 py-3 text-sm font-bold uppercase tracking-wider transition hover:bg-white/5"
            >
              See Pricing
            </Link>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 sm:py-20">
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

      <section style={{ background: 'linear-gradient(160deg, var(--brand-navy) 0%, var(--brand-ink) 70%)' }} className="border-t border-white/10">
        <div className="container mx-auto px-4 py-16 sm:py-20">
          <div className="flex items-center gap-3 mb-3">
            <span className="block w-6 h-px bg-[var(--brand-gold)]" />
            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--brand-gold)]">How It Works</span>
          </div>
          <h2 className="mt-2 text-3xl font-black uppercase leading-none tracking-tighter text-white sm:text-4xl">
            From Sleeper league to league site in four steps.
          </h2>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 border border-white/10">
            {HOW_IT_WORKS.map((item, i) => (
              <div key={item.step} className={`p-6 ${i < HOW_IT_WORKS.length - 1 ? 'border-b sm:border-b-0 sm:border-r border-white/10' : ''}`}>
                <p className="text-4xl font-black text-[var(--brand-gold)] opacity-40 mb-3 leading-none">{item.step}</p>
                <h3 className="text-sm font-black text-white uppercase tracking-wide mb-2">{item.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
