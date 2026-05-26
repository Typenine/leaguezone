/**
 * GET /api/settings/dates  – read current important dates
 * POST /api/settings/dates – update important dates (admin only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isAdminCookieValue } from '@/lib/auth/admin';
import { IMPORTANT_DATES } from '@/lib/constants/league';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdmin(): Promise<boolean> {
  const jar = await cookies();
  return isAdminCookieValue(jar.get('evw_admin')?.value);
}

export async function GET() {
  // Return current values (from env vars or defaults) as ISO strings
  return NextResponse.json({
    nflWeek1: IMPORTANT_DATES.NFL_WEEK_1_START.toISOString(),
    tradeDeadline: IMPORTANT_DATES.TRADE_DEADLINE.toISOString(),
    playoffsStart: IMPORTANT_DATES.PLAYOFFS_START.toISOString(),
    nextDraft: IMPORTANT_DATES.NEXT_DRAFT.toISOString(),
  });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    // Dates are stored as env vars — provide instructions for Vercel deployments.
    // For now we validate and echo back; a future enhancement could store in DB.
    const fields = ['nflWeek1', 'tradeDeadline', 'playoffsStart', 'nextDraft'];
    const result: Record<string, string> = {};
    for (const f of fields) {
      const v = typeof body[f] === 'string' && body[f] ? new Date(body[f]).toISOString() : null;
      if (v) result[f] = v;
    }
    // TODO: persist to leagues.config DB column when available
    return NextResponse.json({
      ok: true,
      note: 'To persist these dates, set the corresponding env vars (NFL_WEEK_1_START, TRADE_DEADLINE, PLAYOFFS_START, NEXT_DRAFT_DATE) in your Vercel dashboard and redeploy.',
      values: result,
    });
  } catch (err) {
    console.error('[settings/dates] POST error:', err);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
