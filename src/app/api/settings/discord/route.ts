/**
 * GET  /api/settings/discord  – read Discord webhook URLs for the active league
 * POST /api/settings/discord  – save Discord webhook URLs (admin only)
 *   body: { suggestions?, trades?, tradeBlock? }
 *   Stored in leagues.config.discordWebhooks; env vars remain as fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isAdminCookieValue } from '@/lib/auth/admin';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { getDiscordWebhooks } from '@/lib/server/league-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdmin(): Promise<boolean> {
  const jar = await cookies();
  return isAdminCookieValue(jar.get('evw_admin')?.value);
}

async function getActiveLeagueId(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get('active_league_id')?.value || undefined;
}

export async function GET() {
  try {
    const leagueId = await getActiveLeagueId();
    const webhooks = await getDiscordWebhooks(leagueId);
    return NextResponse.json(webhooks);
  } catch {
    return NextResponse.json({ suggestions: null, trades: null, tradeBlock: null });
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const suggestions = typeof body.suggestions === 'string' ? body.suggestions.trim() || null : null;
    const trades = typeof body.trades === 'string' ? body.trades.trim() || null : null;
    const tradeBlock = typeof body.tradeBlock === 'string' ? body.tradeBlock.trim() || null : null;

    const leagueId = await getActiveLeagueId();
    const db = getDb();

    const res = leagueId
      ? await db.execute(sql`SELECT id, config FROM leagues WHERE setup_completed = true AND id = ${leagueId}::uuid LIMIT 1`)
      : await db.execute(sql`SELECT id, config FROM leagues WHERE setup_completed = true ORDER BY created_at DESC LIMIT 1`);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    if (!row) return NextResponse.json({ error: 'No league found' }, { status: 404 });

    const config = (row.config as Record<string, unknown>) ?? {};
    const newConfig = { ...config, discordWebhooks: { suggestions, trades, tradeBlock } };

    await db.execute(sql`
      UPDATE leagues
      SET config = ${JSON.stringify(newConfig)}::jsonb, updated_at = now()
      WHERE id = ${row.id as string}::uuid
    `);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[settings/discord] POST error:', err);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
