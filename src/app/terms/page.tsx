import Link from 'next/link';
import type { Metadata } from 'next';
import { Card, CardContent } from '@/components/ui/Card';
import { PLATFORM } from '@/lib/config/platform';

export const metadata: Metadata = {
  title: `Beta Terms — ${PLATFORM.name}`,
  description: 'Plain-language beta testing notice for LeagueZone HQ. Not a finalized Terms of Service.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 text-center">
          <span className="inline-block text-[10px] font-black uppercase tracking-[0.25em] text-[var(--accent)] mb-2">
            Early Beta
          </span>
          <h1 className="text-3xl font-black text-[var(--text)]">Beta Terms</h1>
          <p className="text-sm text-[var(--muted)] mt-2">
            A short, plain-language notice for beta testers — not a finalized commercial Terms of
            Service.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-6 text-sm leading-6 text-[var(--text)]">
            <section>
              <h2 className="font-bold text-base mb-2">This is experimental software</h2>
              <p>
                {PLATFORM.name} is under active development and being tested by a small group of outside
                beta users. You should expect bugs, incomplete features, occasional downtime, and
                behavior that changes between visits as we ship fixes and improvements.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-base mb-2">No uptime or data-permanence guarantee</h2>
              <p>
                We do our best to keep the service running and your league data intact, but during beta
                we make no guarantee of uptime, of feature stability, or that data will never be lost,
                reset, or migrated as the product evolves. Please don&apos;t treat this beta as your only
                copy of anything important to your league.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-base mb-2">Use it like a beta</h2>
              <p>
                Please use a password you don&apos;t reuse elsewhere, report anything broken or confusing
                using the in-app feedback option, and let us know if you&apos;d like your account or data
                removed at any time.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-base mb-2">Not a final agreement</h2>
              <p>
                This page is intentionally short and describes beta testing expectations, not a
                finalized, legally exhaustive commercial Terms of Service. A complete Terms of Service
                and Privacy Policy will be published before any general or commercial launch.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-base mb-2">Questions</h2>
              <p>
                Contact{' '}
                <a href={`mailto:${PLATFORM.contactEmail}`} className="text-[var(--accent)] hover:underline">
                  {PLATFORM.contactEmail}
                </a>
                . See also our{' '}
                <Link href="/privacy" className="text-[var(--accent)] hover:underline">
                  Beta &amp; Privacy Notice
                </Link>
                .
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
