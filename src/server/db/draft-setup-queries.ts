import { sql } from 'drizzle-orm';
import { getDb } from './client';
import { normalizeDraftOrderType, type DraftOrderType } from '@/lib/draft/draft-order';

let orderColumnEnsured = false;

export async function ensureDraftOrderTypeColumn(): Promise<void> {
  if (orderColumnEnsured) return;
  await getDb().execute(sql`
    ALTER TABLE drafts
    ADD COLUMN IF NOT EXISTS draft_order_type varchar(16) NOT NULL DEFAULT 'linear'
  `);
  orderColumnEnsured = true;
}

export async function setDraftOrderType(draftId: string, orderType: DraftOrderType): Promise<void> {
  await ensureDraftOrderTypeColumn();
  const normalized = normalizeDraftOrderType(orderType);
  await getDb().execute(sql`
    UPDATE drafts SET draft_order_type = ${normalized}
    WHERE id = ${draftId}::uuid
  `);
}

export async function getDraftOrderType(draftId: string): Promise<DraftOrderType> {
  await ensureDraftOrderTypeColumn();
  const res = await getDb().execute(sql`
    SELECT draft_order_type FROM drafts WHERE id = ${draftId}::uuid LIMIT 1
  `);
  const row = (res as unknown as { rows?: Array<{ draft_order_type?: unknown }> }).rows?.[0];
  return normalizeDraftOrderType(row?.draft_order_type);
}

/**
 * Return the league teams that originally occupied round 1 of a draft.
 * We intentionally use original_team rather than the current slot owner so
 * approved pick trades never remove a league member from draft-room controls.
 */
export async function getDraftOriginalTeams(draftId: string): Promise<string[]> {
  const res = await getDb().execute(sql`
    SELECT original_team AS team
    FROM draft_slots
    WHERE draft_id = ${draftId}::uuid
      AND round = 1
      AND original_team IS NOT NULL
    ORDER BY overall ASC
  `);
  const rows = (res as unknown as { rows?: Array<{ team?: unknown }> }).rows ?? [];
  const teams: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const team = typeof row.team === 'string' ? row.team.trim() : '';
    if (!team || seen.has(team)) continue;
    seen.add(team);
    teams.push(team);
  }
  return teams;
}

export async function copyDraftSetupMetadata(sourceDraftId: string, targetDraftId: string): Promise<void> {
  await ensureDraftOrderTypeColumn();
  await getDb().execute(sql`
    UPDATE drafts target
    SET player_pool_type = source.player_pool_type,
        player_pool_synced_at = source.player_pool_synced_at,
        draft_order_type = source.draft_order_type
    FROM drafts source
    WHERE source.id = ${sourceDraftId}::uuid
      AND target.id = ${targetDraftId}::uuid
  `);
}
