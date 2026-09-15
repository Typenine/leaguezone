import { sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';

export type ProviderSnapshot<T> = {
  payload: T;
  fetchedAt: Date | string;
  expiresAt: Date | string | null;
};

function rowsOf(result: unknown): Array<Record<string, unknown>> {
  return (result as { rows?: Array<Record<string, unknown>> }).rows ?? [];
}

export async function readProviderSnapshot<T>(
  leagueProviderSeasonId: string,
  snapshotType: string,
): Promise<ProviderSnapshot<T> | null> {
  const db = getDb();
  const result = await db.execute(sql`
    SELECT payload, fetched_at, expires_at
    FROM provider_league_snapshots
    WHERE league_provider_season_id = ${leagueProviderSeasonId}::uuid
      AND snapshot_type = ${snapshotType}
    LIMIT 1
  `);
  const row = rowsOf(result)[0];
  if (!row) return null;
  return {
    payload: row.payload as T,
    fetchedAt: row.fetched_at as Date | string,
    expiresAt: (row.expires_at as Date | string | null) ?? null,
  };
}

export async function writeProviderSnapshot<T>(
  leagueProviderSeasonId: string,
  snapshotType: string,
  payload: T,
  ttlMs?: number,
): Promise<void> {
  const db = getDb();
  const expiresAt = ttlMs && ttlMs > 0 ? new Date(Date.now() + ttlMs) : null;
  await db.execute(sql`
    INSERT INTO provider_league_snapshots (
      league_provider_season_id, snapshot_type, payload, fetched_at, expires_at
    ) VALUES (
      ${leagueProviderSeasonId}::uuid,
      ${snapshotType},
      ${JSON.stringify(payload)}::jsonb,
      now(),
      ${expiresAt}
    )
    ON CONFLICT (league_provider_season_id, snapshot_type) DO UPDATE SET
      payload = EXCLUDED.payload,
      fetched_at = now(),
      expires_at = EXCLUDED.expires_at
  `);
  await db.execute(sql`
    UPDATE league_provider_seasons
    SET last_synced_at = now(), updated_at = now()
    WHERE id = ${leagueProviderSeasonId}::uuid
  `).catch(() => {});
}

export function snapshotIsFresh(snapshot: ProviderSnapshot<unknown> | null, ttlMs: number): boolean {
  if (!snapshot) return false;
  const expiresAt = snapshot.expiresAt ? new Date(snapshot.expiresAt).getTime() : 0;
  if (Number.isFinite(expiresAt) && expiresAt > Date.now()) return true;
  const fetchedAt = new Date(snapshot.fetchedAt).getTime();
  return Number.isFinite(fetchedAt) && Date.now() - fetchedAt < ttlMs;
}
