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
    <div style={{ background: 'var(--brand-ink)' }} className="min-h-screen">
      <section
        style={{ background: 'linear-gradient(160deg, var(--brand-navy) 0%, var(--brand-ink) 70%)', borderTop: `4px solid ${accent}` }}
        className="border-b border-white/10"
      >
        <div className="container mx-auto px-4 py-10 grid gap-8 md:grid-cols-[1fr_0.72fr] md:py-14">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="block w-4 h-px" style={{ background: secondary }} />
              <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: secondary }}>
                {league.shortName || 'League Headquarters'}
              </p>
            </div>
            <h1 className="text-4xl font-black uppercase leading-none tracking-tighter text-white sm:text-5xl">
              {league.name}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/60">
              The official home of {league.name} — standings, teams, draft, trades, rules, and league history in one place.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={dashboardHref(league.id)}
                className="inline-flex items-center justify-center px-7 py-3 text-sm font-black uppercase tracking-widest transition hover:brightness-110"
                style={{ backgroundColor: accent, color: 'var(--brand-ink)' }}
              >
                {membership ? 'Open my dashboard' : 'Enter league dashboard'}
              </a>
              {!membership && (
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center border border-white/25 text-white px-7 py-3 text-sm font-bold uppercase tracking-wider transition hover:bg-white/5"
                >
                  Sign in to join
                </Link>
              )}
            </div>
          </div>

          <div className="border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: secondary }}>League Details</p>
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="text-white/40 uppercase text-[10px] tracking-wider">League name</dt>
                <dd className="mt-1 font-black text-white">{league.name}</dd>
              </div>
              {league.foundedYear && (
                <div>
                  <dt className="text-white/40 uppercase text-[10px] tracking-wider">Founded</dt>
                  <dd className="mt-1 font-black text-white">{league.foundedYear}</dd>
                </div>
              )}
              {membership && (
                <div>
                  <dt className="text-white/40 uppercase text-[10px] tracking-wider">Your team</dt>
                  <dd className="mt-1 font-black text-white">
                    {membership.teamName}
                    {membership.isCommissioner && (
                      <span className="ml-2 text-[10px] text-[var(--brand-gold)] font-black">★ Commissioner</span>
                    )}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-8">
        <h2 className="sr-only">League sections</h2>
        <div className="grid gap-px md:grid-cols-2 lg:grid-cols-3 bg-white/10">
          {sections.map((item) => (
            <Link
              key={item.segment}
              href={leagueUrl(league.slug, item.segment)}
              className="group bg-[var(--brand-ink)] border-t-2 border-[var(--brand-gold)]/40 p-5 hover:border-[var(--brand-gold)] hover:bg-[#071020] transition-all"
            >
              <h3 className="text-sm font-black uppercase tracking-wide text-white group-hover:text-[var(--brand-gold)] transition-colors">{item.label}</h3>
              <p className="mt-2 text-xs text-white/45 leading-relaxed">{SECTION_DESCRIPTIONS[item.segment] || ''}</p>
              <span className="mt-4 inline-flex text-xs font-black uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: accent }}>
                Open {item.label} →
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
