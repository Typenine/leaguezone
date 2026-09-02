import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { verifySession } from '@/lib/server/auth';
import { isSiteAdminCookieValue, isAdminCookieValue } from '@/lib/auth/admin';
import { getUserLeagues } from '@/lib/server/user-auth';
import { getLeagueById } from '@/lib/server/league-context';
import { InviteButton } from './InviteButton';
import { OnboardingHelp } from '@/components/OnboardingHelp';

export const dynamic = 'force-dynamic';

const NAV_SECTIONS = [
  { href: '/standings',    label: 'Standings',     icon: '🏆', description: 'League standings and win/loss records' },
  { href: '/matchups',     label: 'Matchups',      icon: '🏈', description: 'Weekly matchup scores and results' },
  { href: '/teams',        label: 'Teams',         icon: '👥', description: 'Rosters, profiles, and team pages' },
  // Draft hidden until system complete
  { href: '/trades',       label: 'Trades',        icon: '🔄', description: 'Trade history and trade trees' },
  { href: '/transactions', label: 'Transactions',  icon: '📝', description: 'All pickups, drops, and moves' },
  { href: '/suggestions',  label: 'Suggestions',   icon: '💡', description: 'Rule proposals and league voting' },
  { href: '/history',      label: 'History',       icon: '📜', description: 'Champions, records, and past seasons' },
  { href: '/newsletter',   label: 'Newsletter',    icon: '📰', description: 'Weekly recaps and league podcast' },
  { href: '/rules',        label: 'Rules',         icon: '📋', description: 'League constitution and settings' },
];

type LeagueRow = {
  id: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  foundedYear: number | null;
  sleeperLeagueId: string | null;
};

type InviteRow = {
  id: string;
  teamName: string;
  rosterId: number | null;
  claimedAt: string | null;
  inviteCode: string;
};

async function getLeagueData(leagueId?: string): Promise<LeagueRow | null> {
  try {
    const db = getDb();
    const res = leagueId
      ? await db.execute(sql`
          SELECT id, name, short_name, logo_url, primary_color, founded_year, sleeper_league_id
          FROM leagues WHERE setup_completed = true AND id = ${leagueId}::uuid LIMIT 1
        `)
      : await db.execute(sql`
          SELECT id, name, short_name, logo_url, primary_color, founded_year, sleeper_league_id
          FROM leagues WHERE setup_completed = true ORDER BY created_at DESC LIMIT 1
        `);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    if (!row) return null;
    return {
      id: row.id as string,
      name: (row.name as string) || '',
      shortName: (row.short_name as string | null) ?? null,
      logoUrl: (row.logo_url as string | null) ?? null,
      primaryColor: (row.primary_color as string | null) ?? null,
      foundedYear: (row.founded_year as number | null) ?? null,
      sleeperLeagueId: (row.sleeper_league_id as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

async function getLeagueMembers(leagueId: string): Promise<InviteRow[]> {
  try {
    const db = getDb();
    const res = await db.execute(sql`
      SELECT DISTINCT ON (COALESCE(roster_id::text, team_name))
        id, team_name, roster_id, claimed_at, invite_code
      FROM league_invites
      WHERE league_id = ${leagueId}::uuid
      ORDER BY COALESCE(roster_id::text, team_name),
               claimed_at DESC NULLS LAST,
               created_at ASC
    `);
    const rows = (res as { rows?: Array<Record<string, unknown>> }).rows ?? [];
    return rows
      .map((r) => ({
        id: r.id as string,
        teamName: (r.team_name as string) || '',
        rosterId: (r.roster_id as number | null) ?? null,
        claimedAt: (r.claimed_at as string | null) ?? null,
        inviteCode: (r.invite_code as string) || '',
      }))
      .sort((a, b) => (a.rosterId ?? 999) - (b.rosterId ?? 999) || a.teamName.localeCompare(b.teamName));
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const cookieJar = await cookies();

  // ── Auth check ──────────────────────────────────────────────────────────────
  const isSiteAdmin = isSiteAdminCookieValue(cookieJar.get('site_admin')?.value);
  const isAdmin = isAdminCookieValue(cookieJar.get('evw_admin')?.value) || isSiteAdmin;

  const sessionToken = cookieJar.get('evw_session')?.value || '';
  const claims = sessionToken ? verifySession(sessionToken) : null;

  // Not authenticated and not an admin → redirect to login
  if (!claims && !isAdmin) {
    redirect('/login');
  }

  const activeLeagueId = cookieJar.get('active_league_id')?.value || undefined;

  // ── User-based session: resolve which league to show ────────────────────────
  let resolvedLeagueId = activeLeagueId;

  if (claims?.type === 'user') {
    const userId = claims.sub as string;
    const userLeagues = await getUserLeagues(userId);

    // No memberships yet
    if (userLeagues.length === 0 && !isAdmin) {
      return (
        <div style={{ background: 'var(--brand-ink)' }} className="min-h-screen">
          <div style={{ background: 'linear-gradient(160deg, var(--brand-navy) 0%, var(--brand-ink) 70%)' }} className="border-b border-white/10 py-16">
            <div className="container mx-auto px-4 max-w-lg text-center">
              <div className="text-5xl mb-5">🏈</div>
              <div className="flex items-center justify-center gap-3 mb-3">
                <span className="block w-6 h-px bg-[var(--brand-gold)]" />
                <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--brand-gold)]">Not yet in a league</span>
                <span className="block w-6 h-px bg-[var(--brand-gold)]" />
              </div>
              <h1 className="text-3xl font-black text-white uppercase leading-none">You&apos;re not in a league yet</h1>
              <p className="text-white/55 mt-3">To join a league, you&apos;ll need an invite link from your commissioner.</p>
            </div>
          </div>
          <div className="container mx-auto px-4 py-10 max-w-lg">
            <div className="border border-white/10 bg-white/[0.03] p-6 mb-4">
              <h2 className="font-black text-white text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="text-[var(--brand-gold)]">📋</span> How to Join a League
              </h2>
              <ol className="text-sm text-white/55 space-y-3 list-decimal list-inside leading-relaxed">
                <li>Contact your league commissioner and ask for an invite link</li>
                <li>Click the link or paste the invite code during registration</li>
                <li>Your team roster will be automatically connected to your account</li>
                <li>Access standings, trades, and league voting right away</li>
              </ol>
            </div>
            <div className="border border-[var(--brand-gold)]/30 bg-[var(--brand-gold)]/5 p-4 mb-6">
              <p className="text-sm text-white/70">
                <strong className="text-[var(--brand-gold)]">Commissioner?</strong>{' '}
                <Link href="/" className="text-[var(--brand-gold)] hover:underline font-bold">
                  Set up your league here
                </Link>
              </p>
            </div>
            <p className="text-center">
              <Link href="/" className="text-white/35 hover:text-white/70 text-sm uppercase tracking-wider transition-colors">
                ← Back to home
              </Link>
            </p>
          </div>
        </div>
      );
    }

    // Multiple leagues and no active one set — show picker
    const activeMembership = userLeagues.find((l) => l.leagueId === activeLeagueId);
    if (userLeagues.length > 1 && !activeMembership) {
      return (
        <div style={{ background: 'var(--brand-ink)' }} className="min-h-screen">
          <div style={{ background: 'linear-gradient(160deg, var(--brand-navy) 0%, var(--brand-ink) 70%)' }} className="border-b border-white/10">
            <div className="container mx-auto px-4 py-10 max-w-2xl">
              <div className="flex items-center gap-3 mb-2">
                <span className="block w-6 h-px bg-[var(--brand-gold)]" />
                <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--brand-gold)]">Select a League</span>
              </div>
              <h1 className="text-4xl font-black text-white uppercase leading-none">Your Leagues</h1>
            </div>
          </div>
          <div className="container mx-auto px-4 py-10 max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {userLeagues.map((lg) => (
                <LeaguePickerCard key={lg.leagueId} league={lg} />
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Use the only league, or the active one
    if (!resolvedLeagueId && userLeagues.length === 1) {
      resolvedLeagueId = userLeagues[0].leagueId;
    }

    if (resolvedLeagueId) {
      const selectedLeague = await getLeagueById(resolvedLeagueId);
      if (selectedLeague) redirect(`/l/${selectedLeague.slug}/dashboard`);
    }
  }

  // ── Fetch league data ────────────────────────────────────────────────────────
  const league = await getLeagueData(resolvedLeagueId);
  const members = league ? await getLeagueMembers(league.id) : [];
  const claimedCount = members.filter((m) => !!m.claimedAt).length;
  const accent = league?.primaryColor || 'var(--accent)';

  return (
    <div style={{ background: 'var(--brand-ink)' }} className="min-h-screen">

      {/* ── League header ─────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(160deg, var(--brand-navy) 0%, var(--brand-ink) 70%)' }} className="border-b border-white/10">
        <div className="container mx-auto px-4 py-10 flex items-center gap-6">
          {league?.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={league.logoUrl}
              alt={league.name}
              className="w-20 h-20 object-contain border border-[var(--brand-gold)]/30 shrink-0"
            />
          )}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="block w-4 h-px bg-[var(--brand-gold)]" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--brand-gold)]">League HQ</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-white uppercase leading-none tracking-tighter">
              {league?.name ?? 'League Home'}
            </h1>
            {league?.shortName && (
              <p className="text-white/50 mt-1 text-sm uppercase tracking-wider">{league.shortName}</p>
            )}
            {league?.foundedYear && (
              <p className="text-xs text-white/35 mt-0.5 uppercase tracking-wider">Est. {league.foundedYear}</p>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10">

        {/* ── Nav tiles grid ───────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 mb-12">
          {NAV_SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="group bg-[var(--brand-ink)] border-t-2 border-[var(--brand-gold)]/40 p-5 hover:border-[var(--brand-gold)] hover:bg-[#071020] transition-all"
            >
              <div className="text-2xl mb-3 leading-none">{section.icon}</div>
              <div className="font-black text-sm text-white uppercase tracking-wide group-hover:text-[var(--brand-gold)] transition-colors">
                {section.label}
              </div>
              <div className="text-xs text-white/40 mt-1 leading-relaxed">
                {section.description}
              </div>
              <div className="mt-3 text-[var(--brand-gold)] text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                →
              </div>
            </Link>
          ))}
        </div>

        {/* ── League Members ───────────────────────────────────── */}
        {members.length > 0 && (
          <div className="border border-white/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#071020]">
              <div className="flex items-center gap-3">
                <span className="block w-4 h-px bg-[var(--brand-gold)]" />
                <h2 className="font-black text-white text-sm uppercase tracking-wider">League Members</h2>
              </div>
              <span className="text-xs font-bold text-white/35 uppercase tracking-wider">
                {claimedCount} / {members.length} signed up
              </span>
            </div>
            <ul className="divide-y divide-white/5">
              {members.map((member) => {
                const claimed = !!member.claimedAt;
                return (
                  <li key={member.id} className="flex items-center gap-3 px-6 py-3 hover:bg-white/[0.03] transition-colors">
                    <span
                      className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-[10px] font-black"
                      style={{
                        backgroundColor: claimed ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                        color: claimed ? '#22c55e' : 'rgba(255,255,255,0.25)',
                      }}
                      title={claimed ? 'Signed up' : 'Not yet signed up'}
                    >
                      {claimed ? '✓' : '○'}
                    </span>
                    <span
                      className="font-semibold text-sm flex-1 truncate"
                      style={{ color: claimed ? 'white' : 'rgba(255,255,255,0.35)' }}
                    >
                      {member.teamName}
                    </span>
                    {claimed ? (
                      <span className="text-[10px] font-black uppercase tracking-wider shrink-0" style={{ color: accent }}>
                        Active
                      </span>
                    ) : (
                      <span className="text-[10px] text-white/25 uppercase tracking-wider shrink-0">Pending</span>
                    )}
                    <InviteButton teamName={member.teamName} inviteCode={member.inviteCode} />
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Help widget for new users */}
        <OnboardingHelp />
      </div>
    </div>
  );
}

// ── League picker card (client island not needed — just a link) ────────────────
function LeaguePickerCard({
  league,
}: {
  league: { leagueId: string; leagueSlug: string; leagueName: string; teamName: string; isCommissioner: boolean };
}) {
  return (
    <a
      href={`/api/league/select?id=${league.leagueId}&next=/home`}
      className="group block w-full text-left border border-white/10 bg-white/[0.03] p-5 hover:border-[var(--brand-gold)]/50 hover:bg-[#071020] transition-all"
    >
      <div className="font-black text-white uppercase tracking-tight group-hover:text-[var(--brand-gold)] transition-colors">{league.leagueName}</div>
      <div className="text-sm text-white/45 mt-1">
        {league.teamName}
        {league.isCommissioner && (
          <span className="ml-2 text-xs text-[var(--brand-gold)] font-bold">
            ★ Commissioner
          </span>
        )}
      </div>
      <div className="mt-3 text-xs font-black text-[var(--brand-gold)] uppercase tracking-wider">Open dashboard →</div>
    </a>
  );
}
