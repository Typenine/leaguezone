import { cookies } from 'next/headers';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { CURRENT_YEAR } from '@/lib/constants/league';

async function getLeagueName(): Promise<string | null> {
  try {
    const jar = await cookies();
    const activeLeagueId = jar.get('active_league_id')?.value || undefined;
    const db = getDb();
    const res = activeLeagueId
      ? await db.execute(sql`
          SELECT name FROM leagues
          WHERE setup_completed = true AND id = ${activeLeagueId}::uuid
          LIMIT 1
        `)
      : await db.execute(sql`
          SELECT name FROM leagues
          WHERE setup_completed = true AND is_active = true
          ORDER BY created_at ASC
          LIMIT 1
        `);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    return row ? (row.name as string) : null;
  } catch {
    return null;
  }
}

export default async function Footer() {
  const leagueName = await getLeagueName();

  return (
    <footer className="league-surface text-[var(--text)] border-t border-[var(--border)] py-6 mt-auto" role="contentinfo" aria-label="Site footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="mb-2 sm:mb-0 text-sm text-[var(--muted)]">
            © {CURRENT_YEAR} {leagueName ?? 'Fantasy Football League'}
          </div>
        </div>
      </div>
    </footer>
  );
}
