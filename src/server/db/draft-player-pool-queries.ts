import { sql } from 'drizzle-orm';
import { getDb } from './client';
import {
  clearDraftPlayers as clearDraftPlayersLegacy,
  countDraftPlayers as countDraftPlayersLegacy,
  setDraftPlayers as setDraftPlayersLegacy,
} from './queries.fixed';
import {
  normalizeDraftPlayerPoolType,
  isSleeperPlayerEligibleForDraft,
  sleeperDraftPlayerDisplayName,
  type DraftPlayerPoolType,
} from '@/lib/draft/player-pool';
import { getAllPlayersCached, type SleeperPlayer } from '@/lib/utils/sleeper-api';

export type DraftPlayerPoolConfig = {
  type: DraftPlayerPoolType;
  syncedAt: string | null;
  draftableCount: number;
  usesLiveSleeperPool: boolean;
};

let poolColumnsEnsured = false;

export async function ensureDraftPlayerPoolColumns(): Promise<void> {
  if (poolColumnsEnsured) return;
  const db = getDb();
  await db.execute(sql`
    ALTER TABLE drafts
    ADD COLUMN IF NOT EXISTS player_pool_type varchar(32) NOT NULL DEFAULT 'all_players'
  `);
  await db.execute(sql`
    ALTER TABLE drafts
    ADD COLUMN IF NOT EXISTS player_pool_synced_at timestamptz
  `);
  poolColumnsEnsured = true;
}

export async function setDraftPlayerPoolType(draftId: string, poolType: DraftPlayerPoolType): Promise<void> {
  await ensureDraftPlayerPoolColumns();
  const normalized = normalizeDraftPlayerPoolType(poolType);
  await getDb().execute(sql`
    UPDATE drafts
    SET player_pool_type = ${normalized}
    WHERE id = ${draftId}::uuid
  `);
}

export async function getDraftPlayerPoolConfig(draftId: string): Promise<DraftPlayerPoolConfig> {
  await ensureDraftPlayerPoolColumns();
  const res = await getDb().execute(sql`
    SELECT player_pool_type, player_pool_synced_at
    FROM drafts
    WHERE id = ${draftId}::uuid
    LIMIT 1
  `);
  const row = (res as unknown as { rows?: Array<Record<string, unknown>> }).rows?.[0];
  const type = normalizeDraftPlayerPoolType(row?.player_pool_type);
  const draftableCount = await countDraftPlayersLegacy(draftId);
  return {
    type,
    syncedAt: row?.player_pool_synced_at
      ? new Date(row.player_pool_synced_at as string | Date).toISOString()
      : null,
    draftableCount,
    usesLiveSleeperPool: type === 'all_players' && draftableCount === 0,
  };
}

export async function countDraftPlayersForSelection(draftId: string): Promise<number> {
  const count = await countDraftPlayersLegacy(draftId);
  if (count > 0) return count;

  await ensureDraftPlayerPoolColumns();
  const res = await getDb().execute(sql`
    SELECT player_pool_type
    FROM drafts
    WHERE id = ${draftId}::uuid
    LIMIT 1
  `);
  const row = (res as unknown as { rows?: Array<Record<string, unknown>> }).rows?.[0];
  const type = normalizeDraftPlayerPoolType(row?.player_pool_type);

  // The existing draft API treats count > 0 as a scoped pool. Preserve an intentionally
  // empty rookie pool instead of falling through to the unrestricted Sleeper catalog.
  return type === 'all_players' ? 0 : 1;
}

export async function getSleeperDraftPoolPreview(
  year: number,
  poolType: DraftPlayerPoolType,
): Promise<{
  players: Array<{ id: string; name: string; pos: string; nfl: string | null; meta: Record<string, unknown> }>;
  defenses: number;
  rookies: number;
}> {
  const normalized = normalizeDraftPlayerPoolType(poolType);
  if (normalized === 'all_players') return { players: [], defenses: 0, rookies: 0 };

  const catalog = await getAllPlayersCached();
  const players = Object.values(catalog)
    .filter((player: SleeperPlayer) => isSleeperPlayerEligibleForDraft(player, year, normalized))
    .map((player: SleeperPlayer) => ({
      id: player.player_id,
      name: sleeperDraftPlayerDisplayName(player),
      pos: String(player.position || '').toUpperCase(),
      nfl: player.team || null,
      meta: {
        source: 'sleeper',
        college: player.college || null,
        rookieYear: player.rookie_year ?? null,
      },
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    players,
    defenses: players.filter((player) => player.pos === 'DEF').length,
    rookies: players.filter((player) => player.pos !== 'DEF').length,
  };
}

export async function syncSleeperDraftPlayerPool(
  draftId: string,
  year: number,
  poolType: DraftPlayerPoolType,
  prepared?: Awaited<ReturnType<typeof getSleeperDraftPoolPreview>>,
): Promise<{ count: number; defenses: number; rookies: number; usesLiveSleeperPool: boolean }> {
  const normalized = normalizeDraftPlayerPoolType(poolType);
  await ensureDraftPlayerPoolColumns();
  await setDraftPlayerPoolType(draftId, normalized);

  if (normalized === 'all_players') {
    await clearDraftPlayersLegacy(draftId);
    await getDb().execute(sql`
      UPDATE drafts
      SET player_pool_synced_at = now()
      WHERE id = ${draftId}::uuid
    `);
    return { count: 0, defenses: 0, rookies: 0, usesLiveSleeperPool: true };
  }

  const preview = prepared ?? await getSleeperDraftPoolPreview(year, normalized);
  await setDraftPlayersLegacy(draftId, preview.players);
  await getDb().execute(sql`
    UPDATE drafts
    SET player_pool_synced_at = now()
    WHERE id = ${draftId}::uuid
  `);
  return {
    count: preview.players.length,
    defenses: preview.defenses,
    rookies: preview.rookies,
    usesLiveSleeperPool: false,
  };
}
