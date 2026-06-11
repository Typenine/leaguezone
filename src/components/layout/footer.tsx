import Link from 'next/link';
import { cookies } from 'next/headers';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { CURRENT_YEAR } from '@/lib/constants/league';
import { PLATFORM } from '@/lib/config/platform';

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
    <footer className="league-surface text-[var(--text)] border-t border-[var(--border)] py-8 mt-auto" role="contentinfo" aria-label="Site footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="text-sm text-[var(--muted)]">
            <p className="font-bold text-[var(--text)]">{PLATFORM.name}</p>
            <p className="mt-1">© {CURRENT_YEAR} {leagueName ?? PLATFORM.name}</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold text-[var(--muted)]">
            <Link href="/features" className="hover:text-[var(--text)]">Features</Link>
            <Link href="/pricing" className="hover:text-[var(--text)]">Pricing</Link>
            <Link href="/demo" className="hover:text-[var(--text)]">Demo</Link>
            <Link href="/app" className="hover:text-[var(--text)]">Dashboard</Link>
            <a href={`mailto:${PLATFORM.contactEmail}`} className="hover:text-[var(--text)]">Contact</a>
          </nav>
        </div>
        <p className="mt-6 border-t border-[var(--border)] pt-4 text-xs leading-5 text-[var(--muted)]">
          {PLATFORM.disclaimer}
        </p>
      </div>
    </footer>
  );
}
