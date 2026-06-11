import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/server/auth';
import { getCurrentLeagueBySlug, getLeagueFeatures } from '@/lib/server/league-context';
import { getUserLeagues } from '@/lib/server/user-auth';
import { LEAGUE_NAV, leagueUrl } from '@/lib/config/platform';

export const dynamic = 'force-dynamic';

const SECTION_DESCRIPTIONS: Record<string, string> = {
  teams: 'Rosters, franchise pages, and team identity',
  rulebook: 'League constitution, rules, and amendments',
  draft: 'Draft order, pick history, and draft tools',
  'trade-block': 'Who is buying, who is selling, and trade history',
  suggestions: 'Rule suggestions, endorsements, and league votes',
  history: 'Champions, records, brackets, and franchise lineage',
  admin: 'Commissioner settings and league management',
};

function dashboardHref(leagueId: string, next = '/home') {
  return `/api/league/select?id=${encodeURIComponent(leagueId)}&next=${encodeURIComponent(next)}`;
}

export default async function LeagueHomePage({
  params,
}: {
  params: Promise<{ leagueSlug: string }>;
}) {
  const { leagueSlug } = await params;
  const league = await getCurrentLeagueBySlug(leagueSlug);
  if (!league) notFound();

  const cookieJar = await cookies();
  const sessionToken = cookieJar.get('evw_session')?.value || '';
  const claims = sessionToken ? verifySession(sessionToken) : null;
  const userId = claims?.type === 'user' && typeof claims.sub === 'string' ? claims.sub : null;
  const userLeagues = userId ? await getUserLeagues(userId) : [];
  const membership = userLeagues.find((item) => item.leagueId === league.id) ?? null;

  const features = getLeagueFeatures(league);
  const accent = league.primaryColor || 'var(--accent)';
  const secondary = league.secondaryColor || 'var(--gold)';
  const sections = LEAGUE_NAV.filter(
    (item) => item.segment && !item.adminOnly && (!item.feature || features[item.feature])
  );

  return (
    <div className="container mx-auto px-4 py-10">
      <section
        className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-elevated)]"
        style={{ borderTop: `5px solid ${accent}` }}
      >
        <div className="grid gap-8 p-6 md:grid-cols-[1fr_0.72fr] md:p-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: secondary }}>
              {league.shortName || 'League Headquarters'}
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-[var(--text)] sm:text-5xl">
              {league.name}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--muted)]">
              The official home of {league.name} — standings, teams, draft, trades, rules, and league history in one place.
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
                <dt className="text-[var(--muted)]">League name</dt>
                <dd className="mt-1 font-semibold text-[var(--text)]">{league.name}</dd>
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

      <section className="mt-8">
        <h2 className="sr-only">League sections</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sections.map((item) => (
            <Link
              key={item.segment}
              href={leagueUrl(league.slug, item.segment)}
              className="league-card group p-5"
            >
              <h3 className="text-lg font-black text-[var(--text)] group-hover:text-[var(--accent)]">{item.label}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{SECTION_DESCRIPTIONS[item.segment] || ''}</p>
              <span className="mt-4 inline-flex text-sm font-bold" style={{ color: accent }}>
                Open {item.label}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
