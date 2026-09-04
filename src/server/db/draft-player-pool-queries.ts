import { sql } from 'drizzle-orm';
import { getDb } from './client';
import {
  countDraftPlayers as countDraftPlayersLegacy,
  ensureDraftPlayersTable,
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

type DraftPoolPlayer = {
  id: string;
  name: string;
  pos: string;
  nfl: string | null;
  rank?: number | null;
  meta: Record<string, unknown>;
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
  // empty restricted pool instead of falling through to the unrestricted Sleeper catalog.
  return type === 'all_players' ? 0 : 1;
}

async function replaceDraftPlayersBulk(draftId: string, players: DraftPoolPlayer[]): Promise<void> {
  await ensureDraftPlayersTable();
  const db = getDb();
  await db.execute(sql`DELETE FROM draft_players WHERE draft_id = ${draftId}::uuid`);
  if (players.length === 0) return;

  const payload = JSON.stringify(players.map((player) => ({
    id: player.id,
    name: player.name,
    pos: player.pos,
    nfl: player.nfl,
    rank: player.rank ?? null,
    meta: player.meta,
  })));

  await db.execute(sql`
    INSERT INTO draft_players (draft_id, player_id, name, pos, nfl, rank, meta)
    SELECT
      ${draftId}::uuid,
      row.id,
      row.name,
      upper(row.pos),
      row.nfl,
      row.rank,
      row.meta
    FROM jsonb_to_recordset(${payload}::jsonb) AS row(
      id text,
      name text,
      pos text,
      nfl text,
      rank integer,
      meta jsonb
    )
    WHERE row.id <> '' AND row.name <> '' AND row.pos <> ''
    ON CONFLICT (draft_id, player_id) DO UPDATE SET
      name = EXCLUDED.name,
      pos = EXCLUDED.pos,
      nfl = EXCLUDED.nfl,
      rank = EXCLUDED.rank,
      meta = EXCLUDED.meta
  `);
}

export async function getSleeperDraftPoolPreview(
  year: number,
  poolType: DraftPlayerPoolType,
): Promise<{
  players: DraftPoolPlayer[];
  defenses: number;
  rookies: number;
}> {
  const normalized = normalizeDraftPlayerPoolType(poolType);
  const catalog = await getAllPlayersCached(24 * 60 * 60 * 1000);
  const players = Object.values(catalog)
    .filter((player: SleeperPlayer) => {
      if (!isSleeperPlayerEligibleForDraft(player, year, normalized)) return false;
      if (normalized !== 'all_players') return true;
      const status = String(player.status || '').toLowerCase();
      return status !== 'inactive' && status !== 'retired';
    })
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
    rookies: players.filter((player) => player.pos !== 'DEF' && player.meta.rookieYear != null && String(player.meta.rookieYear) === String(year)).length,
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
  const preview = prepared ?? await getSleeperDraftPoolPreview(year, normalized);
  if (normalized === 'all_players' && preview.players.length === 0) {
    throw new Error('Sleeper returned an empty standard player pool');
  }

  // Write the pool first. Only update the persisted rule/sync timestamp after the full
  // replacement succeeds, so a failed refresh cannot relabel or partially clear a draft.
  await replaceDraftPlayersBulk(draftId, preview.players);
  await setDraftPlayerPoolType(draftId, normalized);
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
