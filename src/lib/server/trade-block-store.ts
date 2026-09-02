import { sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';

export type TradeAsset =
  | { type: 'player'; playerId: string }
  | { type: 'pick'; year: number; round: number; originalTeam: string }
  | { type: 'faab'; amount?: number };

export type TradeWants = {
  text?: string;
  positions?: string[];
  contactMethod?: 'text' | 'discord' | 'snap' | 'sleeper';
  phone?: string;
  snap?: string;
  offers?: string;
};

export type TradeBlockLeague = {
  id: string;
  slug: string;
  name: string;
  sleeperLeagueId: string | null;
};

export type TradeBlockTeam = {
  team: string;
  rosterId: number | null;
  userId: string | null;
};

export type LeagueTradeBlockRow = TradeBlockTeam & {
  tradeBlock: TradeAsset[];
  tradeWants: TradeWants | null;
  updatedAt: string | null;
};

function parseTradeBlock(value: unknown): TradeAsset[] {
  return Array.isArray(value) ? value as TradeAsset[] : [];
}

function parseTradeWants(value: unknown): TradeWants | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as TradeWants : null;
}

function isoTimestamp(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function getTradeBlockLeagueById(leagueId: string): Promise<TradeBlockLeague | null> {
  const id = String(leagueId || '').trim();
  if (!id) return null;
  try {
    const db = getDb();
    const res = await db.execute(sql`
      SELECT id::text AS id, slug, name, sleeper_league_id
      FROM leagues
      WHERE id = ${id}::uuid AND setup_completed = true AND is_active = true
      LIMIT 1
    `);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    if (!row) return null;
    const sleeperId = typeof row.sleeper_league_id === 'string' ? row.sleeper_league_id.trim() : '';
    return {
      id: String(row.id),
      slug: String(row.slug || ''),
      name: String(row.name || ''),
      sleeperLeagueId: sleeperId || null,
    };
  } catch {
    return null;
  }
}

export async function listTradeBlockTeams(leagueId: string): Promise<TradeBlockTeam[]> {
  const db = getDb();
  const res = await db.execute(sql`
    SELECT team_name, roster_id, claimed_by::text AS user_id
    FROM league_invites
    WHERE league_id = ${leagueId}::uuid
    ORDER BY roster_id ASC NULLS LAST, team_name ASC
  `);
  const rows = (res as { rows?: Array<Record<string, unknown>> }).rows ?? [];
  return rows.map((row) => ({
    team: String(row.team_name || ''),
    rosterId: row.roster_id == null ? null : Number(row.roster_id),
    userId: row.user_id ? String(row.user_id) : null,
  })).filter((row) => row.team);
}

export async function listLeagueTradeBlocks(leagueId: string): Promise<LeagueTradeBlockRow[]> {
  const db = getDb();
  const res = await db.execute(sql`
    SELECT li.team_name, li.roster_id, li.claimed_by::text AS user_id,
           tb.trade_block, tb.trade_wants, tb.updated_at
    FROM league_invites li
    LEFT JOIN league_trade_blocks tb
      ON tb.league_id = li.league_id AND tb.user_id = li.claimed_by
    WHERE li.league_id = ${leagueId}::uuid
    ORDER BY li.roster_id ASC NULLS LAST, li.team_name ASC
  `);
  const rows = (res as { rows?: Array<Record<string, unknown>> }).rows ?? [];
  return rows.map((row) => ({
    team: String(row.team_name || ''),
    rosterId: row.roster_id == null ? null : Number(row.roster_id),
    userId: row.user_id ? String(row.user_id) : null,
    tradeBlock: parseTradeBlock(row.trade_block),
    tradeWants: parseTradeWants(row.trade_wants),
    updatedAt: isoTimestamp(row.updated_at),
  })).filter((row) => row.team);
}

export async function readLeagueTradeBlock(params: {
  leagueId: string;
  userId: string;
  team: string;
}): Promise<LeagueTradeBlockRow> {
  const db = getDb();
  const res = await db.execute(sql`
    SELECT trade_block, trade_wants, updated_at
    FROM league_trade_blocks
    WHERE league_id = ${params.leagueId}::uuid AND user_id = ${params.userId}::uuid
    LIMIT 1
  `);
  const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
  return {
    team: params.team,
    rosterId: null,
    userId: params.userId,
    tradeBlock: parseTradeBlock(row?.trade_block),
    tradeWants: parseTradeWants(row?.trade_wants),
    updatedAt: isoTimestamp(row?.updated_at),
  };
}

export async function writeLeagueTradeBlock(params: {
  leagueId: string;
  userId: string;
  team: string;
  tradeBlock: TradeAsset[];
  tradeWants: TradeWants | null;
}): Promise<string> {
  const db = getDb();
  const res = await db.execute(sql`
    INSERT INTO league_trade_blocks (league_id, user_id, team_name, version, updated_at, trade_block, trade_wants)
    VALUES (${params.leagueId}::uuid, ${params.userId}::uuid, ${params.team}, 1, now(),
            ${JSON.stringify(params.tradeBlock)}::jsonb,
            ${params.tradeWants ? JSON.stringify(params.tradeWants) : null}::jsonb)
    ON CONFLICT (league_id, user_id)
    DO UPDATE SET team_name = EXCLUDED.team_name,
                  version = league_trade_blocks.version + 1,
                  updated_at = now(),
                  trade_block = EXCLUDED.trade_block,
                  trade_wants = EXCLUDED.trade_wants
    RETURNING updated_at
  `);
  const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
  return isoTimestamp(row?.updated_at) || new Date().toISOString();
}

export async function getTradeBlockDiscordWebhook(leagueId: string): Promise<string | null> {
  try {
    const db = getDb();
    const res = await db.execute(sql`
      SELECT config FROM leagues
      WHERE id = ${leagueId}::uuid AND setup_completed = true AND is_active = true
      LIMIT 1
    `);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    const config = row?.config && typeof row.config === 'object' ? row.config as Record<string, unknown> : {};
    const webhooks = config.discordWebhooks && typeof config.discordWebhooks === 'object'
      ? config.discordWebhooks as Record<string, unknown> : {};
    const value = typeof webhooks.tradeBlock === 'string' ? webhooks.tradeBlock.trim() : '';
    return value || null;
  } catch {
    return null;
  }
}
