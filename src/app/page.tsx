import Link from 'next/link';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';

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

async function getLeagueInfo() {
  try {
    const db = getDb();
    const res = await db.execute(sql`
      SELECT name, short_name FROM leagues WHERE setup_completed = true LIMIT 1
    `);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    return row ? { name: row.name as string, shortName: row.short_name as string | null } : null;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const league = await getLeagueInfo();

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-[var(--text)]">
          {league?.name ?? 'League Home'}
        </h1>
        {league?.shortName && (
          <p className="text-[var(--muted)] mt-1">{league.shortName}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
    </div>
  );
}
