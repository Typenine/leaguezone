import type { Metadata } from 'next';
import { PLATFORM } from '@/lib/config/platform';

export const metadata: Metadata = {
  title: `Pricing — ${PLATFORM.name}`,
  description: `${PLATFORM.name} is currently in beta. Pricing and plan tiers are still to be determined.`,
};

export default function PricingPage() {
  return (
    <div style={{ background: 'var(--brand-ink)' }}>
      <section
        style={{ background: 'linear-gradient(160deg, var(--brand-navy) 0%, var(--brand-ink) 65%)' }}
        className="border-b border-white/10"
      >
        <div className="container mx-auto px-4 py-16 text-center sm:py-20">
          <div className="mb-3 flex items-center justify-center gap-3">
            <span className="block h-px w-6 bg-[var(--brand-gold)]" />
            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--brand-gold)]">
              Beta
            </span>
            <span className="block h-px w-6 bg-[var(--brand-gold)]" />
          </div>
          <h1 className="mx-auto mt-2 max-w-3xl text-4xl font-black uppercase leading-none tracking-tighter text-white sm:text-6xl">
            Pricing is still TBD.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/55">
            LeagueZone is currently in beta. There is no pricing structure, paid tier, or plan lineup yet. Those details will be determined as the platform develops and beta testing continues.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl border border-white/10 bg-white/[0.025] p-7 text-center sm:p-10">
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--brand-gold)]">
            No tiers during beta
          </span>
          <h2 className="mt-4 text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
            No plans to choose from right now.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/55 sm:text-base">
            Pricing, tiers, and included features are all to be determined. The beta is focused on building and testing LeagueZone before any final pricing decisions are made.
          </p>
        </div>

        <p className="mt-10 text-center text-sm text-white/40">
          Questions about the beta?{' '}
          <a href={`mailto:${PLATFORM.contactEmail}`} className="font-bold text-[var(--brand-gold)] hover:underline">
            Get in touch
          </a>
          .
        </p>
      </section>
    </div>
  );
}
