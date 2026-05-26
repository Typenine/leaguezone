import { NextResponse } from 'next/server';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();
    const res = await db.execute(sql`
      SELECT name, short_name FROM leagues WHERE setup_completed = true LIMIT 1
    `);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    if (row) {
      return NextResponse.json({
        name: row.name as string,
        shortName: (row.short_name as string | null) ?? null,
      });
    }
    return NextResponse.json({ name: null, shortName: null });
  } catch {
    return NextResponse.json({ name: null, shortName: null });
  }
}
