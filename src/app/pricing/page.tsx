import type { Metadata } from 'next';
import Link from 'next/link';
import { PLATFORM, PRICING_TIERS } from '@/lib/config/platform';

export const metadata: Metadata = {
  title: `Pricing — ${PLATFORM.name}`,
  description: `Simple pricing for ${PLATFORM.name} league websites.`,
};

export default function PricingPage() {
  return (
    <div style={{ background: 'var(--brand-ink)' }}>
      <section style={{ background: 'linear-gradient(160deg, var(--brand-navy) 0%, var(--brand-ink) 65%)' }} className="border-b border-white/10">
        <div className="container mx-auto px-4 py-16 text-center sm:py-20">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="block w-6 h-px bg-[var(--brand-gold)]" />
            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--brand-gold)]">Pricing</span>
            <span className="block w-6 h-px bg-[var(--brand-gold)]" />
          </div>
          <h1 className="mx-auto mt-2 max-w-3xl text-4xl font-black uppercase leading-none tracking-tighter text-white sm:text-6xl">
            Built for leagues that take it seriously.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/55">
            Pricing is being finalized during the beta. Early leagues get white-glove setup and a say in what gets built next.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 sm:py-20">
        <div className="grid gap-4 lg:grid-cols-3">
          {PRICING_TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`league-card flex flex-col p-6 ${tier.highlighted ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/5' : ''}`}
            >
              {tier.highlighted && (
                <span className="mb-4 text-[10px] font-black uppercase tracking-[0.25em] text-[var(--brand-gold)] block">
                  Most Popular
                </span>
              )}
              <h2 className="text-sm font-black uppercase tracking-wide text-white">{tier.name}</h2>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-4xl font-black text-white">{tier.price}</span>
                <span className="text-sm text-white/45">{tier.period}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-white/50">{tier.description}</p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-white/65">
                    <span aria-hidden="true" className="mt-0.5 font-black text-[var(--brand-gold)] shrink-0">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href={tier.href}
                className={`mt-8 w-full inline-flex items-center justify-center py-3 text-xs font-black uppercase tracking-wider transition ${
                  tier.highlighted
                    ? 'bg-[var(--brand-gold)] text-[var(--brand-ink)] hover:brightness-110'
                    : 'border border-white/20 text-white hover:bg-white/5'
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-white/40">
          Questions about setup for your league?{' '}
          <a href={`mailto:${PLATFORM.contactEmail}`} className="font-bold text-[var(--brand-gold)] hover:underline">
            Get in touch
          </a>
          .
        </p>
      </section>
    </div>
  );
}
