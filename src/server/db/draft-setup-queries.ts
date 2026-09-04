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
