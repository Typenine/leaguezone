import { NextRequest, NextResponse } from 'next/server';
import { isLeagueAdminRequest } from '@/lib/server/admin-auth';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { getLeagueIdsFromDb } from '@/lib/server/league-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function sleeperPing() {
  const { current: leagueId } = await getLeagueIdsFromDb();
  if (!leagueId) return { ok: false, error: 'No league ID configured' };

  const start = Date.now();
  const res = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`, { cache: 'no-store' });
  const ms = Date.now() - start;
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, ms };
  const data = await res.json();
  return {
    ok: true,
    ms,
    leagueId,
    leagueName: data.name || null,
    season: data.season || null,
    status: data.status || null,
    totalRosters: data.total_rosters || null,
  };
}

async function discordTest(webhookKey: string) {
  const webhookEnvKeys: Record<string, string> = {
    trades: 'DISCORD_TRADES_WEBHOOK_URL',
    newsletter: 'DISCORD_NEWSLETTER_WEBHOOK_URL',
    taxi: 'DISCORD_TAXI_WEBHOOK_URL',
    general: 'DISCORD_WEBHOOK_URL',
  };
  const envKey = webhookEnvKeys[webhookKey] || webhookEnvKeys.general;
  const webhookUrl = process.env[envKey]?.trim();
  if (!webhookUrl) return { ok: false, error: `${envKey} is not configured` };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title: '🔧 Admin Test Message',
        description: `Webhook test fired from the admin tools panel at ${new Date().toLocaleString()}`,
        color: 0x5865f2,
        footer: { text: 'Admin Tools · Test' },
      }],
      allowed_mentions: { parse: [] },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, error: `Discord returned ${res.status}: ${text}` };
  }
  return { ok: true, webhook: webhookKey };
}

async function setupReset() {
  const db = getDb();
  const res = await db.execute(sql`
    UPDATE leagues SET setup_completed = false, updated_at = now()
    WHERE id = (SELECT id FROM leagues ORDER BY created_at DESC LIMIT 1)
    RETURNING id, name
  `);
  const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
  if (!row) return { ok: false, error: 'No league found' };
  return { ok: true, leagueId: row.id, leagueName: row.name, message: 'Setup marked as incomplete — visit /setup to re-run the wizard.' };
}

async function clearTradeEvents() {
  const db = getDb();
  await db.execute(sql`DELETE FROM discord_notifications WHERE notification_type IN ('trade_pending', 'trade_complete')`);
  return { ok: true, message: 'All Discord trade notification records cleared — trade notifier will re-post all trades on next run.' };
}

async function cronTrigger(job: string, origin: string, cronSecret: string | null) {
  const jobRoutes: Record<string, string> = {
    'trade-notifier': '/api/cron/trade-notifier',
    'taxi': '/api/taxi/cron',
    'lineup-snapshot': '/api/lineups/snapshot/cron',
  };
  const path = jobRoutes[job];
  if (!path) return { ok: false, error: `Unknown job: ${job}. Valid jobs: ${Object.keys(jobRoutes).join(', ')}` };

  const url = `${origin}${path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cronSecret) headers['x-cron-secret'] = cronSecret;
  const start = Date.now();
  const res = await fetch(url, { method: 'GET', headers, cache: 'no-store' });
  const ms = Date.now() - start;
  let data: unknown;
  try { data = await res.json(); } catch { data = null; }
  return { ok: res.ok, status: res.status, ms, job, data };
}

async function dbCounts() {
  const db = getDb();
  const queries: Array<[string, ReturnType<typeof sql>]> = [
    ['leagues', sql`SELECT COUNT(*)::int AS cnt FROM leagues`],
    ['users', sql`SELECT COUNT(*)::int AS cnt FROM users`],
    ['teams', sql`SELECT COUNT(*)::int AS cnt FROM teams`],
    ['taxi_observations', sql`SELECT COUNT(*)::int AS cnt FROM taxi_observations`],
    ['discord_notifications', sql`SELECT COUNT(*)::int AS cnt FROM discord_notifications`],
    ['team_pins', sql`SELECT COUNT(*)::int AS cnt FROM team_pins`],
    ['taxi_snapshots', sql`SELECT COUNT(*)::int AS cnt FROM taxi_snapshots`],
  ];
  const counts: Record<string, number> = {};
  await Promise.all(queries.map(async ([t, q]) => {
    try {
      const r = await db.execute(q);
      counts[t] = Number((r as { rows?: Array<Record<string, unknown>> }).rows?.[0]?.cnt ?? 0);
    } catch { counts[t] = -1; }
  }));
  return { ok: true, counts };
}

export async function POST(req: NextRequest) {
  if (!(await isLeagueAdminRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = typeof body.action === 'string' ? body.action : '';
  try {
    switch (action) {
      case 'sleeper-ping':
        return NextResponse.json(await sleeperPing());
      case 'discord-test': {
        const webhook = typeof body.webhook === 'string' ? body.webhook : 'general';
        return NextResponse.json(await discordTest(webhook));
      }
      case 'setup-reset':
        return NextResponse.json(await setupReset());
      case 'clear-trade-events':
        return NextResponse.json(await clearTradeEvents());
      case 'cron-trigger': {
        const job = typeof body.job === 'string' ? body.job : '';
        const cronSecret = process.env.CRON_SECRET?.trim() || process.env.TAXI_CRON_SECRET?.trim() || null;
        return NextResponse.json(await cronTrigger(job, req.nextUrl.origin, cronSecret));
      }
      case 'db-counts':
        return NextResponse.json(await dbCounts());
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (e) {
    console.error(`[admin/tools/actions] ${action} error:`, e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
