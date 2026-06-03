/**
 * GET /api/settings/dates  – read current important dates
 * POST /api/settings/dates – update important dates (admin only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isAdminCookieValue } from '@/lib/auth/admin';
import { IMPORTANT_DATES } from '@/lib/constants/league';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdmin(): Promise<boolean> {
  const jar = await cookies();
  return isAdminCookieValue(jar.get('evw_admin')?.value);
}

type ImportantDatesConfig = {
  nflWeek1?: string;
  tradeDeadline?: string;
  playoffsStart?: string;
  nextDraft?: string;
};

async function getLeagueRow() {
  const jar = await cookies();
  const activeLeagueId = jar.get('active_league_id')?.value || undefined;
  const db = getDb();
  const res = activeLeagueId
    ? await db.execute(sql`SELECT id, config FROM leagues WHERE setup_completed = true AND id = ${activeLeagueId}::uuid LIMIT 1`)
    : await db.execute(sql`SELECT id, config FROM leagues WHERE setup_completed = true ORDER BY created_at DESC LIMIT 1`);
  return (res as { rows?: Array<Record<string, unknown>> }).rows?.[0] ?? null;
}

function readImportantDates(config: Record<string, unknown>): ImportantDatesConfig {
  const dates = config.importantDates;
  return dates && typeof dates === 'object' && !Array.isArray(dates)
    ? (dates as ImportantDatesConfig)
    : {};
}

function toValidIso(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

export async function GET() {
  const row = await getLeagueRow().catch(() => null);
  const config = (row?.config as Record<string, unknown>) ?? {};
  const configuredDates = readImportantDates(config);
  const envNextDraft = toValidIso(process.env.NEXT_DRAFT_DATE);
  const nextDraft = toValidIso(configuredDates.nextDraft) ?? envNextDraft ?? null;

  return NextResponse.json({
    nflWeek1: toValidIso(configuredDates.nflWeek1) ?? IMPORTANT_DATES.NFL_WEEK_1_START.toISOString(),
    tradeDeadline: toValidIso(configuredDates.tradeDeadline) ?? IMPORTANT_DATES.TRADE_DEADLINE.toISOString(),
    playoffsStart: toValidIso(configuredDates.playoffsStart) ?? IMPORTANT_DATES.PLAYOFFS_START.toISOString(),
    nextDraft,
    nextDraftConfigured: Boolean(nextDraft),
  });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const row = await getLeagueRow();
    if (!row) return NextResponse.json({ error: 'No league found' }, { status: 404 });

    const fields = ['nflWeek1', 'tradeDeadline', 'playoffsStart', 'nextDraft'];
    const result: Record<string, string> = {};
    for (const f of fields) {
      const v = toValidIso(body[f]);
      if (v) result[f] = v;
    }

    const leagueId = row.id as string;
    const config = (row.config as Record<string, unknown>) ?? {};
    const nextConfig = {
      ...config,
      importantDates: result,
    };
    const db = getDb();
    await db.execute(sql`
      UPDATE leagues
      SET config = ${JSON.stringify(nextConfig)}::jsonb,
          updated_at = now()
      WHERE id = ${leagueId}::uuid
    `);

    return NextResponse.json({
      ok: true,
      values: result,
    });
  } catch (err) {
    console.error('[settings/dates] POST error:', err);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
