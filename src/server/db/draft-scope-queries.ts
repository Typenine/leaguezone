import { cookies } from 'next/headers';
import { sql } from 'drizzle-orm';
import { getDb } from './client';
import * as legacy from './queries.fixed';
import { getCurrentLeague } from '@/lib/server/league-context';
import { getActiveQaSession } from '@/lib/server/qa-session';

export type DraftEnvironment = 'live' | 'rehearsal';
export type ScopedDraftSummary = {
  id: string;
  leagueId: string;
  year: number;
  rounds: number;
  clockSeconds: number;
  status: string;
  environment: DraftEnvironment;
  qaSessionId: string | null;
  archivedAt: string | null;
  createdAt: string;
  completedAt: string | null;
};

let scopeEnsured = false;

export async function ensureDraftTablesScoped(): Promise<void> {
  await legacy.ensureDraftTables();
  if (scopeEnsured) return;
  const db = getDb();
  await db.execute(sql`ALTER TABLE drafts ADD COLUMN IF NOT EXISTS league_id uuid REFERENCES leagues(id)`).catch(() => {});
  await db.execute(sql`ALTER TABLE drafts ADD COLUMN IF NOT EXISTS environment varchar(16) NOT NULL DEFAULT 'live'`).catch(() => {});
  await db.execute(sql`ALTER TABLE drafts ADD COLUMN IF NOT EXISTS qa_session_id uuid`).catch(() => {});
  await db.execute(sql`ALTER TABLE drafts ADD COLUMN IF NOT EXISTS archived_at timestamptz`).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS drafts_league_env_idx ON drafts(league_id, environment, year, created_at DESC)`).catch(() => {});
  await db.execute(sql`CREATE INDEX IF NOT EXISTS drafts_qa_session_idx ON drafts(qa_session_id)`).catch(() => {});
  await db.execute(sql`ALTER TABLE draft_workspace ALTER COLUMN id TYPE varchar(96)`).catch(() => {});
  await db.execute(sql`
    UPDATE drafts
    SET league_id = (SELECT id FROM leagues WHERE setup_completed = true LIMIT 1)
    WHERE league_id IS NULL
      AND (SELECT COUNT(*) FROM leagues WHERE setup_completed = true) = 1
  `).catch(() => {});
  scopeEnsured = true;
}

async function requestContext(): Promise<{ leagueId: string | null; qaSessionId: string | null; environment: DraftEnvironment }> {
  const qa = await getActiveQaSession();
  if (qa) {
    return {
      leagueId: qa.leagueId,
      qaSessionId: qa.id,
      environment: qa.mode === 'rehearsal' ? 'rehearsal' : 'live',
    };
  }
  const league = await getCurrentLeague();
  return { leagueId: league?.id ?? null, qaSessionId: null, environment: 'live' };
}

function workspaceKey(leagueId: string, qaSessionId?: string | null): string {
  return qaSessionId ? `qa:${qaSessionId}` : `league:${leagueId}`;
}

async function readWorkspace(key: string): Promise<legacy.DraftWorkspaceRow | null> {
  const res = await getDb().execute(sql`
    SELECT event_name, event_logo_url, event_color_1, event_color_2, default_player_pool_id
    FROM draft_workspace WHERE id = ${key} LIMIT 1
  `);
  const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
  if (!row) return null;
  return {
    eventName: row.event_name ? String(row.event_name) : null,
    eventLogoUrl: row.event_logo_url ? String(row.event_logo_url) : null,
    eventColor1: row.event_color_1 ? String(row.event_color_1) : null,
    eventColor2: row.event_color_2 ? String(row.event_color_2) : null,
    defaultPlayerPoolId: row.default_player_pool_id ? String(row.default_player_pool_id) : null,
  };
}

async function workspaceFor(leagueId: string, qaSessionId?: string | null): Promise<legacy.DraftWorkspaceRow | null> {
  await ensureDraftTablesScoped();
  if (qaSessionId) {
    const qaWorkspace = await readWorkspace(workspaceKey(leagueId, qaSessionId));
    if (qaWorkspace) return qaWorkspace;
  }
  return (await readWorkspace(workspaceKey(leagueId))) || (await readWorkspace('default'));
}

async function writeWorkspace(
  leagueId: string,
  qaSessionId: string | null,
  values: Partial<legacy.DraftWorkspaceRow>,
): Promise<void> {
  await ensureDraftTablesScoped();
  const key = workspaceKey(leagueId, qaSessionId);
  const existing = (await readWorkspace(key)) || (await workspaceFor(leagueId, qaSessionId));
  const next = {
    eventName: values.eventName !== undefined ? values.eventName : existing?.eventName ?? null,
    eventLogoUrl: values.eventLogoUrl !== undefined ? values.eventLogoUrl : existing?.eventLogoUrl ?? null,
    eventColor1: values.eventColor1 !== undefined ? values.eventColor1 : existing?.eventColor1 ?? null,
    eventColor2: values.eventColor2 !== undefined ? values.eventColor2 : existing?.eventColor2 ?? null,
    defaultPlayerPoolId: values.defaultPlayerPoolId !== undefined ? values.defaultPlayerPoolId : existing?.defaultPlayerPoolId ?? null,
  };
  await getDb().execute(sql`
    INSERT INTO draft_workspace (id, event_name, event_logo_url, event_color_1, event_color_2, default_player_pool_id)
    VALUES (${key}, ${next.eventName}, ${next.eventLogoUrl}, ${next.eventColor1}, ${next.eventColor2}, ${next.defaultPlayerPoolId}::uuid)
    ON CONFLICT (id) DO UPDATE SET
      event_name = EXCLUDED.event_name,
      event_logo_url = EXCLUDED.event_logo_url,
      event_color_1 = EXCLUDED.event_color_1,
      event_color_2 = EXCLUDED.event_color_2,
      default_player_pool_id = EXCLUDED.default_player_pool_id
  `);
}

export async function getDraftWorkspaceScoped(): Promise<legacy.DraftWorkspaceRow | null> {
  const ctx = await requestContext();
  if (!ctx.leagueId) return legacy.getDraftWorkspace();
  return workspaceFor(ctx.leagueId, ctx.environment === 'rehearsal' ? ctx.qaSessionId : null);
}

export async function saveDraftWorkspaceBrandingScoped(branding: {
  eventName?: string | null;
  eventLogoUrl?: string | null;
  eventColor1?: string | null;
  eventColor2?: string | null;
}): Promise<void> {
  const ctx = await requestContext();
  if (!ctx.leagueId) return legacy.saveDraftWorkspaceBranding(branding);
  await writeWorkspace(ctx.leagueId, ctx.environment === 'rehearsal' ? ctx.qaSessionId : null, branding);
}

export async function setDraftWorkspaceDefaultPoolScoped(poolId: string | null): Promise<void> {
  const ctx = await requestContext();
  if (!ctx.leagueId) return legacy.setDraftWorkspaceDefaultPool(poolId);
  await writeWorkspace(ctx.leagueId, ctx.environment === 'rehearsal' ? ctx.qaSessionId : null, { defaultPlayerPoolId: poolId });
}

async function seedFromWorkspace(draftId: string, leagueId: string, qaSessionId?: string | null): Promise<void> {
  const workspace = await workspaceFor(leagueId, qaSessionId);
  if (!workspace) return;
  await getDb().execute(sql`
    UPDATE drafts SET
      event_name = ${workspace.eventName},
      event_logo_url = ${workspace.eventLogoUrl},
      event_color_1 = ${workspace.eventColor1},
      event_color_2 = ${workspace.eventColor2}
    WHERE id = ${draftId}::uuid
  `);
  if (workspace.defaultPlayerPoolId) {
    await legacy.copyPlayerPoolToDraft(workspace.defaultPlayerPoolId, draftId);
  }
}

export async function seedDraftFromWorkspaceScoped(draftId: string): Promise<void> {
  const ctx = await requestContext();
  if (!ctx.leagueId) return legacy.seedDraftFromWorkspace(draftId);
  await seedFromWorkspace(draftId, ctx.leagueId, ctx.environment === 'rehearsal' ? ctx.qaSessionId : null);
}

export async function updateDraftBrandingScoped(draftId: string, branding: {
  eventName?: string | null;
  eventLogoUrl?: string | null;
  eventColor1?: string | null;
  eventColor2?: string | null;
}): Promise<void> {
  await ensureDraftTablesScoped();
  await getDb().execute(sql`
    UPDATE drafts SET
      event_name = ${branding.eventName ?? null},
      event_logo_url = ${branding.eventLogoUrl ?? null},
      event_color_1 = ${branding.eventColor1 ?? null},
      event_color_2 = ${branding.eventColor2 ?? null}
    WHERE id = ${draftId}::uuid
  `);
  await saveDraftWorkspaceBrandingScoped(branding);
}

export async function scopeDraft(
  draftId: string,
  leagueId: string,
  environment: DraftEnvironment,
  qaSessionId?: string | null,
): Promise<void> {
  await ensureDraftTablesScoped();
  await getDb().execute(sql`
    UPDATE drafts
    SET league_id = ${leagueId}::uuid,
        environment = ${environment},
        qa_session_id = ${qaSessionId ?? null}::uuid,
        archived_at = NULL
    WHERE id = ${draftId}::uuid
  `);
}

export async function createDraftWithOrderScoped(params: Parameters<typeof legacy.createDraftWithOrder>[0]) {
  const ctx = await requestContext();
  if (!ctx.leagueId) throw new Error('active_league_required');
  const result = await legacy.createDraftWithOrder(params);
  await scopeDraft(result.id, ctx.leagueId, ctx.environment, ctx.environment === 'rehearsal' ? ctx.qaSessionId : null);
  await seedFromWorkspace(result.id, ctx.leagueId, ctx.environment === 'rehearsal' ? ctx.qaSessionId : null);
  return result;
}

export async function getActiveOrLatestDraftIdScoped(): Promise<string | null> {
  await ensureDraftTablesScoped();
  const db = getDb();
  const qa = await getActiveQaSession();
  if (qa?.mode === 'rehearsal' && qa.draftId) {
    const rehearsal = await db.execute(sql`
      SELECT id::text AS id FROM drafts
      WHERE id = ${qa.draftId}::uuid
        AND league_id = ${qa.leagueId}::uuid
        AND environment = 'rehearsal'
        AND qa_session_id = ${qa.id}::uuid
      LIMIT 1
    `);
    const row = (rehearsal as { rows?: Array<{ id: string }> }).rows?.[0];
    if (row?.id) return row.id;
  }

  const league = await getCurrentLeague();
  if (!league) return null;

  try {
    const jar = await cookies();
    const selected = jar.get('lz_admin_draft_id')?.value || '';
    if (selected) {
      const selectedRes = await db.execute(sql`
        SELECT id::text AS id FROM drafts
        WHERE id = ${selected}::uuid
          AND league_id = ${league.id}::uuid
          AND environment = 'live'
          AND archived_at IS NULL
        LIMIT 1
      `);
      const row = (selectedRes as { rows?: Array<{ id: string }> }).rows?.[0];
      if (row?.id) return row.id;
    }
  } catch {}

  const active = await db.execute(sql`
    SELECT id::text AS id FROM drafts
    WHERE league_id = ${league.id}::uuid
      AND environment = 'live'
      AND archived_at IS NULL
      AND status IN ('LIVE','PAUSED')
    ORDER BY created_at DESC LIMIT 1
  `);
  const activeRow = (active as { rows?: Array<{ id: string }> }).rows?.[0];
  if (activeRow?.id) return activeRow.id;

  const latest = await db.execute(sql`
    SELECT id::text AS id FROM drafts
    WHERE league_id = ${league.id}::uuid
      AND environment = 'live'
      AND archived_at IS NULL
    ORDER BY year DESC, created_at DESC LIMIT 1
  `);
  return (latest as { rows?: Array<{ id: string }> }).rows?.[0]?.id || null;
}

export async function listLeagueDrafts(leagueId: string, includeRehearsals = true): Promise<ScopedDraftSummary[]> {
  await ensureDraftTablesScoped();
  const res = await getDb().execute(sql`
    SELECT id::text AS id, league_id::text AS league_id, year, rounds, clock_seconds, status,
           environment, qa_session_id::text AS qa_session_id, archived_at, created_at, completed_at
    FROM drafts
    WHERE league_id = ${leagueId}::uuid
      AND (${includeRehearsals} OR environment = 'live')
    ORDER BY year DESC, created_at DESC
  `);
  const rows = (res as { rows?: Array<Record<string, unknown>> }).rows ?? [];
  return rows.map((row) => ({
    id: String(row.id),
    leagueId: String(row.league_id),
    year: Number(row.year),
    rounds: Number(row.rounds),
    clockSeconds: Number(row.clock_seconds),
    status: String(row.status),
    environment: String(row.environment || 'live') as DraftEnvironment,
    qaSessionId: row.qa_session_id ? String(row.qa_session_id) : null,
    archivedAt: row.archived_at ? new Date(row.archived_at as string | Date).toISOString() : null,
    createdAt: new Date(row.created_at as string | Date).toISOString(),
    completedAt: row.completed_at ? new Date(row.completed_at as string | Date).toISOString() : null,
  }));
}

export async function findLiveDraftForYear(leagueId: string, year: number): Promise<string | null> {
  await ensureDraftTablesScoped();
  const res = await getDb().execute(sql`
    SELECT id::text AS id FROM drafts
    WHERE league_id = ${leagueId}::uuid
      AND environment = 'live'
      AND year = ${year}
      AND archived_at IS NULL
    ORDER BY created_at DESC LIMIT 1
  `);
  return (res as { rows?: Array<{ id: string }> }).rows?.[0]?.id || null;
}

export async function createLiveDraftForLeague(params: {
  leagueId: string;
  year: number;
  rounds: number;
  teams: string[];
  clockSeconds: number;
  roundOrders?: Record<number, string[]>;
}): Promise<string> {
  const result = await legacy.createDraftWithOrder(params);
  await scopeDraft(result.id, params.leagueId, 'live', null);
  await seedFromWorkspace(result.id, params.leagueId, null);
  return result.id;
}

export async function createRehearsalDraftForLeague(params: {
  leagueId: string;
  qaSessionId: string;
  year: number;
  rounds: number;
  teams: string[];
  clockSeconds: number;
  sourceDraftId?: string | null;
}): Promise<string> {
  await ensureDraftTablesScoped();
  const db = getDb();

  if (params.sourceDraftId) {
    const headRes = await db.execute(sql`
      SELECT year, rounds, clock_seconds, event_name, event_logo_url, event_color_1, event_color_2
      FROM drafts
      WHERE id = ${params.sourceDraftId}::uuid AND league_id = ${params.leagueId}::uuid
      LIMIT 1
    `);
    const head = (headRes as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    if (head) {
      const slotRes = await db.execute(sql`
        SELECT round, pick_in_round, team FROM draft_slots
        WHERE draft_id = ${params.sourceDraftId}::uuid
        ORDER BY round, pick_in_round
      `);
      const slots = (slotRes as { rows?: Array<{ round: number; pick_in_round: number; team: string }> }).rows ?? [];
      const roundOrders: Record<number, string[]> = {};
      for (const slot of slots) {
        if (!roundOrders[slot.round]) roundOrders[slot.round] = [];
        roundOrders[slot.round].push(slot.team);
      }
      const result = await legacy.createDraftWithOrder({
        year: Number(head.year),
        rounds: Number(head.rounds),
        teams: roundOrders[1]?.length ? roundOrders[1] : params.teams,
        roundOrders,
        clockSeconds: Number(head.clock_seconds),
      });
      await scopeDraft(result.id, params.leagueId, 'rehearsal', params.qaSessionId);
      await db.execute(sql`
        UPDATE drafts SET event_name = ${head.event_name as string | null},
          event_logo_url = ${head.event_logo_url as string | null},
          event_color_1 = ${head.event_color_1 as string | null},
          event_color_2 = ${head.event_color_2 as string | null}
        WHERE id = ${result.id}::uuid
      `);
      const players = await legacy.getDraftPlayers(params.sourceDraftId).catch(() => []);
      if (players.length > 0) {
        await legacy.setDraftPlayers(result.id, players.map((p) => ({ id: p.player_id, name: p.name, pos: p.pos, nfl: p.nfl, rank: p.rank, meta: p.meta })));
      }
      await db.execute(sql`
        INSERT INTO draft_pick_videos (draft_id, overall, video_url, player_name)
        SELECT ${result.id}::uuid, overall, video_url, player_name
        FROM draft_pick_videos WHERE draft_id = ${params.sourceDraftId}::uuid
        ON CONFLICT (draft_id, overall) DO NOTHING
      `).catch(() => {});
      return result.id;
    }
  }

  const result = await legacy.createDraftWithOrder({
    year: params.year,
    rounds: params.rounds,
    teams: params.teams,
    clockSeconds: params.clockSeconds,
  });
  await scopeDraft(result.id, params.leagueId, 'rehearsal', params.qaSessionId);
  await seedFromWorkspace(result.id, params.leagueId, null);
  return result.id;
}

async function deleteDraftRows(draftId: string): Promise<void> {
  const db = getDb();
  await db.execute(sql`DELETE FROM draft_trade_assets WHERE trade_id IN (SELECT id FROM draft_trades WHERE draft_id = ${draftId}::uuid)`).catch(() => {});
  await db.execute(sql`DELETE FROM draft_trades WHERE draft_id = ${draftId}::uuid`).catch(() => {});
  await db.execute(sql`DELETE FROM draft_roster_snapshots WHERE draft_id = ${draftId}::uuid`).catch(() => {});
  await db.execute(sql`DELETE FROM draft_future_picks WHERE draft_id = ${draftId}::uuid`).catch(() => {});
  await db.execute(sql`DELETE FROM draft_pending_picks WHERE draft_id = ${draftId}::uuid`).catch(() => {});
  await db.execute(sql`DELETE FROM draft_picks WHERE draft_id = ${draftId}::uuid`).catch(() => {});
  await db.execute(sql`DELETE FROM draft_queues WHERE draft_id = ${draftId}::uuid`).catch(() => {});
  await db.execute(sql`DELETE FROM draft_pick_videos WHERE draft_id = ${draftId}::uuid`).catch(() => {});
  await db.execute(sql`DELETE FROM draft_players WHERE draft_id = ${draftId}::uuid`).catch(() => {});
  await db.execute(sql`DELETE FROM draft_slots WHERE draft_id = ${draftId}::uuid`).catch(() => {});
  await db.execute(sql`DELETE FROM drafts WHERE id = ${draftId}::uuid`);
}

export async function deleteRehearsalDraft(draftId: string, qaSessionId: string): Promise<void> {
  await ensureDraftTablesScoped();
  const res = await getDb().execute(sql`
    SELECT 1 FROM drafts WHERE id = ${draftId}::uuid AND environment = 'rehearsal' AND qa_session_id = ${qaSessionId}::uuid LIMIT 1
  `);
  if (((res as { rows?: unknown[] }).rows ?? []).length === 0) throw new Error('rehearsal_draft_not_found');
  await deleteDraftRows(draftId);
}

export async function deleteDraftScoped(draftId: string): Promise<{ ok: true }> {
  await ensureDraftTablesScoped();
  const res = await getDb().execute(sql`SELECT environment, status FROM drafts WHERE id = ${draftId}::uuid LIMIT 1`);
  const row = (res as { rows?: Array<{ environment: string; status: string }> }).rows?.[0];
  if (!row) return { ok: true };
  if (row.environment === 'rehearsal' || row.status === 'NOT_STARTED') {
    await deleteDraftRows(draftId);
    return { ok: true };
  }
  throw new Error('active_or_completed_drafts_must_be_archived');
}

export async function archiveLiveDraft(draftId: string, leagueId: string): Promise<void> {
  await ensureDraftTablesScoped();
  const res = await getDb().execute(sql`
    UPDATE drafts SET archived_at = now()
    WHERE id = ${draftId}::uuid
      AND league_id = ${leagueId}::uuid
      AND environment = 'live'
      AND status = 'COMPLETED'
      AND archived_at IS NULL
    RETURNING id
  `);
  if (((res as { rows?: unknown[] }).rows ?? []).length === 0) {
    throw new Error('only_completed_live_drafts_can_be_archived');
  }
}
