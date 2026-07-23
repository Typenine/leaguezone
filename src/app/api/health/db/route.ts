import { sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await getDb().execute(sql`SELECT 1 AS ok`);
    return Response.json({ ok: true });
  } catch (error) {
    console.error('[health/db] Database health check failed', error);
    return Response.json({ ok: false }, { status: 503 });
  }
}
