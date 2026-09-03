import { NextRequest, NextResponse } from 'next/server';
import { isLeagueAdminRequest } from '@/lib/server/admin-auth';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!(await isLeagueAdminRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const results: Record<string, unknown> = {};

  try {
    const db = getDb();
    const tableChecks = await db.execute(sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    const tables = ((tableChecks as { rows?: Array<Record<string, unknown>> }).rows ?? []).map((r) => r.table_name as string);
    const counts: Record<string, number> = {};
    const coreCountQueries: Array<[string, ReturnType<typeof sql>]> = [
      ['leagues', sql`SELECT COUNT(*)::int AS cnt FROM leagues`],
      ['users', sql`SELECT COUNT(*)::int AS cnt FROM users`],
      ['teams', sql`SELECT COUNT(*)::int AS cnt FROM teams`],
      ['discord_notifications', sql`SELECT COUNT(*)::int AS cnt FROM discord_notifications`],
    ];
    await Promise.all(coreCountQueries.map(async ([t, q]) => {
      if (!tables.includes(t)) return;
      try {
        const r = await db.execute(q);
        counts[t] = Number((r as { rows?: Array<Record<string, unknown>> }).rows?.[0]?.cnt ?? 0);
      } catch { counts[t] = -1; }
    }));
    results.db = { ok: true, tables, counts };
  } catch (e) {
    results.db = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  try {
    const db = getDb();
    const setupRes = await db.execute(sql`SELECT id, setup_completed, name, config FROM leagues ORDER BY created_at DESC LIMIT 1`);
    const row = (setupRes as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    if (row) {
      const config = (row.config as Record<string, unknown>) || {};
      results.setup = {
        leagueId: row.id,
        leagueName: row.name,
        completed: !!row.setup_completed,
        completedSteps: (config.completedSetupSteps as string[]) || [],
        sleeperLeagueId: config.sleeperLeagueId ?? null,
      };
    } else {
      results.setup = { completed: false, completedSteps: [] };
    }
  } catch {
    results.setup = { completed: false, completedSteps: [], error: 'DB unavailable' };
  }

  const r2Vars = {
    R2_ACCOUNT_ID: !!process.env.R2_ACCOUNT_ID?.trim(),
    R2_ACCESS_KEY_ID: !!process.env.R2_ACCESS_KEY_ID?.trim(),
    R2_SECRET_ACCESS_KEY: !!process.env.R2_SECRET_ACCESS_KEY?.trim(),
    R2_BUCKET: !!process.env.R2_BUCKET?.trim(),
    R2_PUBLIC_BASE: !!process.env.R2_PUBLIC_BASE?.trim(),
  };
  results.r2 = { configured: Object.values(r2Vars).every(Boolean), vars: r2Vars };

  const sleeperLeagueId = process.env.SLEEPER_LEAGUE_ID?.trim() || null;
  results.sleeper = { configured: !!sleeperLeagueId, leagueId: sleeperLeagueId };
  results.discord = {
    trades: !!process.env.DISCORD_TRADES_WEBHOOK_URL?.trim(),
    newsletter: !!process.env.DISCORD_NEWSLETTER_WEBHOOK_URL?.trim(),
    taxi: !!process.env.DISCORD_TAXI_WEBHOOK_URL?.trim(),
    general: !!process.env.DISCORD_WEBHOOK_URL?.trim(),
  };
  results.resend = {
    configured: !!process.env.RESEND_API_KEY?.trim(),
    fromConfigured: !!process.env.EMAIL_FROM?.trim(),
  };
  results.groq = { configured: !!process.env.GROQ_API_KEY?.trim() };
  results.cron = {
    secret: !!process.env.CRON_SECRET?.trim(),
    taxiSecret: !!process.env.TAXI_CRON_SECRET?.trim(),
  };
  results.site = {
    siteUrl: process.env.SITE_URL?.trim() || null,
    nodeEnv: process.env.NODE_ENV,
    adminSecret: !!process.env.EVW_ADMIN_SECRET?.trim(),
    superAdminKey: !!process.env.SUPER_ADMIN_KEY?.trim(),
    authSecret: !!process.env.AUTH_SECRET?.trim(),
  };

  return NextResponse.json(results);
}
