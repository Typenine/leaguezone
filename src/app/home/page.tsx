import Link from 'next/link';
import { cookies } from 'next/headers';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';

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
      SELECT id, team_name, roster_id, claimed_at
      FROM league_invites
      WHERE league_id = ${leagueId}::uuid
      ORDER BY roster_id ASC NULLS LAST, team_name ASC
    `);
    const rows = (res as { rows?: Array<Record<string, unknown>> }).rows ?? [];
    return rows.map((r) => ({
      id: r.id as string,
      teamName: (r.team_name as string) || '',
      rosterId: (r.roster_id as number | null) ?? null,
      claimedAt: (r.claimed_at as string | null) ?? null,
    }));
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const cookieJar = await cookies();
  const activeLeagueId = cookieJar.get('active_league_id')?.value || undefined;

  const league = await getLeagueData(activeLeagueId);
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
                  {/* Status icon */}
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

                  {!claimed && (
                    <span className="ml-auto text-xs text-[var(--muted)] italic">Pending</span>
                  )}
                  {claimed && (
                    <span
                      className="ml-auto text-xs font-medium"
                      style={{ color: accent }}
                    >
                      Active
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
