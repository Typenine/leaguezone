import type { Metadata } from 'next';
import Link from 'next/link';
import { PLATFORM, PRICING_TIERS } from '@/lib/config/platform';

export const metadata: Metadata = {
  title: `Pricing — ${PLATFORM.name}`,
  description: `Simple pricing for ${PLATFORM.name} league websites.`,
};

export default function PricingPage() {
  return (
    <div className="home-page">
      <section className="border-b border-[var(--border)] bg-[var(--home-hero)]">
        <div className="container mx-auto px-4 py-16 text-center sm:py-20">
          <p className="eyebrow">Pricing</p>
          <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-black tracking-[-0.05em] text-[var(--text)] sm:text-6xl">
            Built for leagues that take it seriously.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
            Pricing is being finalized during the beta. Early leagues get white-glove setup and a say in what gets built next.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 sm:py-20">
        <div className="grid gap-6 lg:grid-cols-3">
          {PRICING_TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`league-card flex flex-col p-6 ${tier.highlighted ? 'border-[var(--accent)] shadow-[var(--shadow-elevated)]' : ''}`}
            >
              {tier.highlighted && (
                <span className="mb-4 inline-flex self-start rounded-full bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
                  Most popular
                </span>
              )}
              <h2 className="text-xl font-black text-[var(--text)]">{tier.name}</h2>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-4xl font-black text-[var(--text)]">{tier.price}</span>
                <span className="text-sm text-[var(--muted)]">{tier.period}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{tier.description}</p>
              <ul className="mt-6 flex-1 space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-[var(--text)]">
                    <span aria-hidden="true" className="mt-0.5 font-bold text-[var(--accent)]">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href={tier.href}
                className={`mt-8 inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-bold transition ${
                  tier.highlighted
                    ? 'bg-[var(--accent)] text-white shadow-lg hover:opacity-90'
                    : 'border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]/60'
                }`}
                style={tier.highlighted ? { color: 'white' } : undefined}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-[var(--muted)]">
          Questions about setup for your league?{' '}
          <a href={`mailto:${PLATFORM.contactEmail}`} className="font-bold text-[var(--accent)] hover:underline">
            Get in touch
          </a>
          .
        </p>
      </section>
    </div>
  );
}
