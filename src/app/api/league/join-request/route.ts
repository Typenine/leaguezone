import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type JoinRequest = {
  id: string;
  leagueId: string;
  name: string;
  email: string;
  message?: string;
  sleeperLeagueId?: string;
  createdAt: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const leagueId = typeof body.leagueId === 'string' ? body.leagueId.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 120) : '';
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 300) : '';
    const sleeperLeagueId = typeof body.sleeperLeagueId === 'string' ? body.sleeperLeagueId.trim().slice(0, 32) : '';

    if (!leagueId) return NextResponse.json({ error: 'leagueId is required' }, { status: 400 });
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    if (!email || !email.includes('@') || !email.includes('.')) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
    }

    const db = getDb();
    const res = await db.execute(sql`
      SELECT id::text AS id, config
      FROM leagues
      WHERE setup_completed = true
        AND is_active = true
        AND id = ${leagueId}::uuid
      LIMIT 1
    `);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    if (!row) return NextResponse.json({ error: 'League not found' }, { status: 404 });

    const config = (row.config as Record<string, unknown>) ?? {};
    const existing = Array.isArray(config.joinRequests)
      ? (config.joinRequests as JoinRequest[])
      : [];
    const request: JoinRequest = {
      id: `jr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      leagueId,
      name,
      email,
      ...(message ? { message } : {}),
      ...(sleeperLeagueId ? { sleeperLeagueId } : {}),
      createdAt: new Date().toISOString(),
    };

    await db.execute(sql`
      UPDATE leagues
      SET config = ${JSON.stringify({ ...config, joinRequests: [request, ...existing].slice(0, 100) })}::jsonb,
          updated_at = now()
      WHERE id = ${leagueId}::uuid
    `);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[league/join-request] POST error:', err);
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
  }
}
