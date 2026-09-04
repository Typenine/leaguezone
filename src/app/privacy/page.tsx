import Link from 'next/link';
import type { Metadata } from 'next';
import { Card, CardContent } from '@/components/ui/Card';
import { PLATFORM } from '@/lib/config/platform';

export const metadata: Metadata = {
  title: `Beta & Privacy Notice — ${PLATFORM.name}`,
  description: 'What LeagueZone HQ stores during the public beta, and how to request account or data deletion.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 text-center">
          <span className="inline-block text-[10px] font-black uppercase tracking-[0.25em] text-[var(--accent)] mb-2">
            Early Beta
          </span>
          <h1 className="text-3xl font-black text-[var(--text)]">Beta &amp; Privacy Notice</h1>
          <p className="text-sm text-[var(--muted)] mt-2">
            Plain-language summary of what {PLATFORM.name} stores and how to reach us. Last updated{' '}
            {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-6 text-sm leading-6 text-[var(--text)]">
            <section>
              <h2 className="font-bold text-base mb-2">This is an early beta</h2>
              <p>
                {PLATFORM.name} is currently in a small, invite/Reddit-recruited public beta, not a
                finished commercial product. Features, page layouts, and how data is organized may
                change — sometimes significantly — while we build the product. We&apos;ll try to avoid
                losing your data, but you should not treat this beta as a permanent system of record.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-base mb-2">What account data we store</h2>
              <p className="mb-2">When you create an account, we store:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Your email address and display name</li>
                <li>A one-way hash of your password (bcrypt) — we do not store, and cannot see, your plaintext password</li>
                <li>Which leagues you belong to and any team(s) you&apos;re associated with in those leagues</li>
              </ul>
            </section>

            <section>
              <h2 className="font-bold text-base mb-2">League data imported from Sleeper</h2>
              <p>
                If a commissioner connects a league to Sleeper during setup, {PLATFORM.name} reads that
                league&apos;s public roster, standings, matchup, and transaction data from Sleeper&apos;s API to
                populate the league site. This data comes from a connected third-party provider (Sleeper)
                and reflects what that provider has for the league — we don&apos;t independently verify it.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-base mb-2">League-generated content</h2>
              <p>
                Content you or your league create inside the product — rules, suggestions, trade block
                posts, newsletter content, settings, and similar — is stored so the league site can
                display it. This content may be visible to other members of the same league.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-base mb-2">Account security</h2>
              <p>
                Passwords are hashed with bcrypt before storage; we never store or transmit your password
                in plaintext. Because this is beta software under active development, we recommend you{' '}
                <strong>do not reuse a password you use elsewhere</strong> — use a unique password for your
                {' '}{PLATFORM.name} account.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-base mb-2">Requesting account or data deletion</h2>
              <p className="mb-2">
                If you&apos;d like your account and associated data removed, you can:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  Use <strong>&quot;Request account deletion&quot;</strong> from the account menu while
                  signed in, or
                </li>
                <li>
                  Email{' '}
                  <a href={`mailto:${PLATFORM.contactEmail}`} className="text-[var(--accent)] hover:underline">
                    {PLATFORM.contactEmail}
                  </a>{' '}
                  from the address on your account
                </li>
              </ul>
              <p className="mt-2">
                We review deletion requests manually rather than deleting automatically, because league
                data (rosters, trade history, suggestions) is often shared with — and relied on by — other
                members of your league. We&apos;ll confirm with you what will be removed before we act on it.
              </p>
            </section>

            <section>
              <h2 className="font-bold text-base mb-2">Questions</h2>
              <p>
                For anything else about your data or this beta, contact{' '}
                <a href={`mailto:${PLATFORM.contactEmail}`} className="text-[var(--accent)] hover:underline">
                  {PLATFORM.contactEmail}
                </a>
                . See also our{' '}
                <Link href="/terms" className="text-[var(--accent)] hover:underline">
                  Beta Terms
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
