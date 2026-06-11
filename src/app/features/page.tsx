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
    <div className="home-page">
      <section className="border-b border-[var(--border)] bg-[var(--home-hero)]">
        <div className="container mx-auto px-4 py-16 sm:py-20">
          <p className="eyebrow">Features</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-[-0.05em] text-[var(--text)] sm:text-6xl">
            Everything Sleeper doesn&apos;t do, in one league headquarters.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
            {PLATFORM.name} works alongside your Sleeper league. Rosters and scores stay where they are —
            your identity, rules, history, and league culture get a real home.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/demo"
              className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-7 py-3 text-base font-bold text-white shadow-lg transition hover:opacity-90"
              style={{ color: 'white' }}
            >
              View Demo League
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-7 py-3 text-base font-bold text-[var(--text)] transition hover:border-[var(--accent)]/60"
            >
              See pricing
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

      <section className="border-t border-[var(--border)] bg-[var(--home-hero)]">
        <div className="container mx-auto px-4 py-16 sm:py-20">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[var(--text)] sm:text-4xl">
            From Sleeper league to league site in four steps.
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="league-card p-5">
                <p className="text-sm font-black text-[var(--accent)]">{item.step}</p>
                <h3 className="mt-2 text-lg font-black text-[var(--text)]">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
