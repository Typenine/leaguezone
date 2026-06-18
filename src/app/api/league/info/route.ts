import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const jar = await cookies();
    const activeLeagueId = jar.get('active_league_id')?.value || undefined;
    const db = getDb();
    const res = activeLeagueId
      ? await db.execute(sql`
          SELECT name, short_name, logo_url, founded_year
          FROM leagues
          WHERE setup_completed = true AND id = ${activeLeagueId}::uuid
          LIMIT 1
        `)
      : await db.execute(sql`
          SELECT name, short_name, logo_url, founded_year
          FROM leagues
          WHERE setup_completed = true
          ORDER BY created_at DESC
          LIMIT 1
        `);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    if (row) {
      return NextResponse.json({
        name: row.name as string,
        shortName: (row.short_name as string | null) ?? null,
        logoUrl: (row.logo_url as string | null) ?? null,
        foundedYear: (row.founded_year as number | null) ?? null,
      });
    }
    return NextResponse.json({ name: null, shortName: null, logoUrl: null, foundedYear: null });
  } catch {
    return NextResponse.json({ name: null, shortName: null, logoUrl: null, foundedYear: null });
  }
}
