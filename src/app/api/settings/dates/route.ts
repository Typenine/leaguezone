/**
 * GET /api/settings/dates  – read current important dates
 * POST /api/settings/dates – update important dates (admin only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isAdminCookieValue } from '@/lib/auth/admin';
import { IMPORTANT_DATES } from '@/lib/constants/league';
import { getActiveLeagueMembership } from '@/lib/server/membership';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { getCurrentLeague } from '@/lib/server/league-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireCommissionerOrAdmin(): Promise<boolean> {
  const jar = await cookies();
  if (isAdminCookieValue(jar.get('evw_admin')?.value)) return true;
  const m = await getActiveLeagueMembership();
  return m.ok && m.membership.isCommissioner;
}

type ImportantDatesConfig = {
  nflWeek1?: string;
  tradeDeadline?: string;
  playoffsStart?: string;
  nextDraft?: string;
  faBiddingStart?: string;
};

async function getLeagueRow() {
  const league = await getCurrentLeague();
  if (!league) return null;
  const db = getDb();
  const res = await db.execute(sql`SELECT id, config FROM leagues WHERE setup_completed = true AND id = ${league.id}::uuid LIMIT 1`);
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
    faBiddingStart: toValidIso(configuredDates.faBiddingStart) ?? null,
    calendarEvents: Array.isArray(config.calendarEvents) ? config.calendarEvents : [],
    nextDraftConfigured: Boolean(nextDraft),
  });
}

export async function POST(req: NextRequest) {
  if (!(await requireCommissionerOrAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const row = await getLeagueRow();
    if (!row) return NextResponse.json({ error: 'No league found' }, { status: 404 });

    const fields = ['nflWeek1', 'tradeDeadline', 'playoffsStart', 'nextDraft', 'faBiddingStart'];
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
      calendarEvents: Array.isArray(body.calendarEvents)
        ? body.calendarEvents.filter((entry: unknown) => {
            if (!entry || typeof entry !== 'object') return false;
            const item = entry as Record<string, unknown>;
            return typeof item.label === 'string' && Boolean(toValidIso(item.date));
          }).map((entry: Record<string, unknown>) => ({ label: String(entry.label).trim(), date: toValidIso(entry.date), description: typeof entry.description === 'string' ? entry.description.trim() : undefined }))
        : Array.isArray(config.calendarEvents) ? config.calendarEvents : [],
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
