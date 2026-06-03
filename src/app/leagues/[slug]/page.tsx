import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/server/auth';
import { getLeagueBySlug } from '@/lib/server/league-config';
import { getUserLeagues } from '@/lib/server/user-auth';

export const dynamic = 'force-dynamic';

const LEAGUE_LINKS = [
  { href: '/standings', label: 'Standings', description: 'Current table and season records' },
  { href: '/teams', label: 'Teams', description: 'Rosters, franchise pages, and player cards' },
  { href: '/draft?view=next', label: 'Draft', description: 'Projected order, picks, and draft tools' },
  { href: '/history', label: 'History', description: 'Champions, records, brackets, and leaders' },
  { href: '/trades', label: 'Trades', description: 'Trade history, trees, and analysis' },
  { href: '/rules', label: 'Rules', description: 'League constitution and settings' },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function dashboardHref(leagueId: string, next = '/home') {
  return `/api/league/select?id=${encodeURIComponent(leagueId)}&next=${encodeURIComponent(next)}`;
}

export default async function LeagueHomepage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const cookieJar = await cookies();
  const sessionToken = cookieJar.get('evw_session')?.value || '';
  const claims = sessionToken ? verifySession(sessionToken) : null;
  const userId = claims?.type === 'user' && typeof claims.sub === 'string' ? claims.sub : null;
  const userLeagues = userId ? await getUserLeagues(userId) : [];
  const membership = userLeagues.find((item) => item.leagueId === league.id) ?? null;
  const accent = league.primaryColor || 'var(--accent)';
  const secondary = league.secondaryColor || 'var(--gold)';

  return (
    <div className="container mx-auto px-4 py-10">
      <section
        className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-elevated)]"
        style={{ borderTop: `5px solid ${accent}` }}
      >
        <div className="grid gap-8 p-6 md:grid-cols-[1fr_0.72fr] md:p-10">
          <div>
            <div className="mb-6 flex items-center gap-4">
              <div
                className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-[var(--border)]"
                style={{ backgroundColor: `color-mix(in srgb, ${accent} 18%, transparent)` }}
              >
                {league.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={league.logoUrl} alt={league.name} className="h-full w-full object-contain" />
                ) : (
                  <span className="text-lg font-black" style={{ color: accent }}>{initials(league.name)}</span>
                )}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">League Homepage</p>
                <h1 className="mt-1 text-4xl font-black tracking-[-0.05em] text-[var(--text)]">{league.name}</h1>
              </div>
            </div>

            <p className="max-w-2xl text-lg leading-8 text-[var(--muted)]">
              {league.shortName || 'A dedicated league hub for managers, standings, history, draft context, trades, and league rules.'}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={dashboardHref(league.id)}
                className="inline-flex items-center justify-center rounded-full px-7 py-3 text-base font-bold text-white shadow-lg transition hover:opacity-90"
                style={{ backgroundColor: accent, color: 'white' }}
              >
                {membership ? 'Open my dashboard' : 'Enter league dashboard'}
              </a>
              {!membership && (
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-7 py-3 text-base font-bold text-[var(--text)] transition hover:border-[var(--accent)]/60"
                >
                  Sign in to join
                </Link>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: secondary }}>League Details</p>
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="text-[var(--muted)]">Short name</dt>
                <dd className="mt-1 font-semibold text-[var(--text)]">{league.shortName || league.name}</dd>
              </div>
              {league.foundedYear && (
                <div>
                  <dt className="text-[var(--muted)]">Founded</dt>
                  <dd className="mt-1 font-semibold text-[var(--text)]">{league.foundedYear}</dd>
                </div>
              )}
              {membership && (
                <div>
                  <dt className="text-[var(--muted)]">Your team</dt>
                  <dd className="mt-1 font-semibold text-[var(--text)]">
                    {membership.teamName}
                    {membership.isCommissioner && (
                      <span className="ml-2 text-xs text-[var(--gold)]" aria-label="Commissioner">★ Commissioner</span>
                    )}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {LEAGUE_LINKS.map((item) => (
          <a
            key={item.href}
            href={dashboardHref(league.id, item.href)}
            className="league-card group p-5"
          >
            <h2 className="text-lg font-black text-[var(--text)] group-hover:text-[var(--accent)]">{item.label}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{item.description}</p>
            <span className="mt-4 inline-flex text-sm font-bold" style={{ color: accent }}>Open {item.label}</span>
          </a>
        ))}
      </section>
    </div>
  );
}
