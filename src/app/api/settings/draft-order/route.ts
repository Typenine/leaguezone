import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sql } from 'drizzle-orm';
import { isAdminCookieValue } from '@/lib/auth/admin';
import { getDb } from '@/server/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getLeagueRow() {
  const jar = await cookies();
  const activeLeagueId = jar.get('active_league_id')?.value || undefined;
  const db = getDb();
  const res = activeLeagueId
    ? await db.execute(sql`SELECT id, config FROM leagues WHERE setup_completed = true AND id = ${activeLeagueId}::uuid LIMIT 1`)
    : await db.execute(sql`SELECT id, config FROM leagues WHERE setup_completed = true ORDER BY created_at DESC LIMIT 1`);
  return (res as { rows?: Array<Record<string, unknown>> }).rows?.[0] ?? null;
}

export async function POST(req: NextRequest) {
  const jar = await cookies();
  if (!isAdminCookieValue(jar.get('evw_admin')?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const season = Number(body.season);
    if (!Number.isFinite(season)) {
      return NextResponse.json({ error: 'season is required' }, { status: 400 });
    }

    const row = await getLeagueRow();
    if (!row) return NextResponse.json({ error: 'No league found' }, { status: 404 });

    const config = (row.config as Record<string, unknown>) ?? {};
    const existingOrders = config.projectedDraftOrders;
    const projectedDraftOrders: Record<string, number[]> =
      existingOrders && typeof existingOrders === 'object' && !Array.isArray(existingOrders)
        ? { ...(existingOrders as Record<string, number[]>) }
        : {};

    if (body.reset === true) {
      delete projectedDraftOrders[String(season)];
    } else {
      if (!Array.isArray(body.rosterIds)) {
        return NextResponse.json({ error: 'rosterIds must be an array' }, { status: 400 });
      }

      const rosterIds = body.rosterIds.map((id: unknown) => Number(id));
      if (rosterIds.length === 0 || rosterIds.some((id: number) => !Number.isFinite(id))) {
        return NextResponse.json({ error: 'rosterIds contains invalid values' }, { status: 400 });
      }

      if (new Set(rosterIds).size !== rosterIds.length) {
        return NextResponse.json({ error: 'Each team can appear only once in the draft order' }, { status: 400 });
      }

      projectedDraftOrders[String(season)] = rosterIds;
    }

    const nextConfig = {
      ...config,
      projectedDraftOrders,
    };

    const db = getDb();
    await db.execute(sql`
      UPDATE leagues
      SET config = ${JSON.stringify(nextConfig)}::jsonb,
          updated_at = now()
      WHERE id = ${(row.id as string)}::uuid
    `);

    return NextResponse.json({ ok: true, projectedDraftOrders });
  } catch (err) {
    console.error('[settings/draft-order] POST error:', err);
    return NextResponse.json({ error: 'Failed to save draft order' }, { status: 500 });
  }
}
