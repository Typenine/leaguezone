import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { verifySession } from '@/lib/server/auth';
import { isSiteAdminCookieValue, isAdminCookieValue } from '@/lib/auth/admin';
import { getUserLeagues } from '@/lib/server/user-auth';
import { InviteButton } from './InviteButton';

export const dynamic = 'force-dynamic';

const NAV_SECTIONS = [
  { href: '/standings',    label: 'Standings',     icon: '🏆', description: 'League standings and win/loss records' },
  { href: '/matchups',     label: 'Matchups',      icon: '🏈', description: 'Weekly matchup scores and results' },
  { href: '/teams',        label: 'Teams',         icon: '👥', description: 'Rosters, profiles, and team pages' },
  { href: '/trades',       label: 'Trades',        icon: '🔄', description: 'Trade history and trade trees' },
  { href: '/transactions', label: 'Transactions',  icon: '📝', description: 'All pickups, drops, and moves' },
  { href: '/suggestions',  label: 'Suggestions',   icon: '💡', description: 'Rule proposals and league voting' },
  { href: '/history',      label: 'History',       icon: '📜', description: 'Champions, records, and past seasons' },
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
        <div className="container mx-auto px-4 py-20 max-w-lg text-center">
          <div className="text-5xl mb-4">🏈</div>
          <h1 className="text-2xl font-bold text-[var(--text)] mb-2">You&apos;re not in a league yet</h1>
          <p className="text-[var(--muted)] mb-8">
            Ask your commissioner for an invite link to join a league.
          </p>
          <Link
            href="/"
            className="text-[var(--accent)] hover:underline text-sm"
          >
            ← Back to home
          </Link>
        </div>
      );
    }

    // Multiple leagues and no active one set — show picker
    const activeMembership = userLeagues.find((l) => l.leagueId === activeLeagueId);
    if (userLeagues.length > 1 && !activeMembership) {
      return (
        <div className="container mx-auto px-4 py-10 max-w-2xl">
          <h1 className="text-3xl font-bold text-[var(--text)] mb-2">Your Leagues</h1>
          <p className="text-[var(--muted)] mb-8">Select a league to view.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {userLeagues.map((lg) => (
              <LeaguePickerCard key={lg.leagueId} league={lg} />
            ))}
          </div>
        </div>
      );
    }

    // Use the only league, or the active one
    if (!resolvedLeagueId && userLeagues.length === 1) {
      resolvedLeagueId = userLeagues[0].leagueId;
    }
  }

  // ── Fetch league data ────────────────────────────────────────────────────────
  const league = await getLeagueData(resolvedLeagueId);
  const members = league ? await getLeagueMembers(league.id) : [];
  const claimedCount = members.filter((m) => !!m.claimedAt).length;
  const accent = league?.primaryColor || 'var(--accent)';

  return (
    <div className="container mx-auto px-4 py-10">
      {/* League header */}
      <div className="mb-10 flex items-center gap-5">
        {league?.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={league.logoUrl}
            alt={league.name}
            className="w-16 h-16 rounded-xl object-contain border border-[var(--border)]"
          />
        )}
        <div>
          <h1 className="text-3xl font-bold text-[var(--text)]">
            {league?.name ?? 'League Home'}
          </h1>
          {league?.shortName && (
            <p className="text-[var(--muted)] mt-0.5">{league.shortName}</p>
          )}
          {league?.foundedYear && (
            <p className="text-xs text-[var(--muted)] mt-0.5">Est. {league.foundedYear}</p>
          )}
        </div>
      </div>

      {/* Nav cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {NAV_SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/60 hover:bg-[color-mix(in_srgb,var(--accent)_5%,var(--surface))] transition-all group"
          >
            <div className="text-3xl mb-3">{section.icon}</div>
            <div className="font-semibold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
              {section.label}
            </div>
            <div className="text-sm text-[var(--muted)] mt-1">
              {section.description}
            </div>
          </Link>
        ))}
      </div>

      {/* League Members */}
      {members.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
            <h2 className="font-semibold text-[var(--text)]">League Members</h2>
            <span className="text-sm text-[var(--muted)]">
              {claimedCount} / {members.length} signed up
            </span>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {members.map((member) => {
              const claimed = !!member.claimedAt;
              return (
                <li key={member.id} className="flex items-center gap-3 px-6 py-3">
                  <span
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs"
                    style={{
                      backgroundColor: claimed ? '#22c55e22' : 'var(--surface-strong, #f3f4f6)',
                      color: claimed ? '#16a34a' : 'var(--muted)',
                    }}
                    title={claimed ? 'Signed up' : 'Not yet signed up'}
                  >
                    {claimed ? '✓' : '⏱'}
                  </span>

                  <span
                    className="font-medium text-sm"
                    style={{ color: claimed ? 'var(--text)' : 'var(--muted)' }}
                  >
                    {member.teamName}
                  </span>

                  {claimed ? (
                    <span className="text-xs font-medium" style={{ color: accent }}>
                      Active
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--muted)] italic">Pending</span>
                  )}

                  <InviteButton teamName={member.teamName} inviteCode={member.inviteCode} />
                </li>
              );
            })}
          </ul>
        </div>
      )}
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
      className="block w-full text-left rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 hover:border-[var(--accent)]/60 transition-all"
    >
        <div className="font-semibold text-[var(--text)]">{league.leagueName}</div>
        <div className="text-sm text-[var(--muted)] mt-1">
          {league.teamName}
          {league.isCommissioner && (
            <span className="ml-2 text-xs text-[var(--accent)] font-medium">Commissioner</span>
          )}
        </div>
        <div className="mt-3 text-xs font-semibold text-[var(--accent)]">Open dashboard</div>
    </a>
  );
}
