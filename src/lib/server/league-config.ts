/**
 * Server-side utility for reading Sleeper league IDs from the database.
 * Use this in API routes and server components where process.env may not
 * have SLEEPER_LEAGUE_ID set (i.e. the user configured via setup wizard).
 *
 * When a LeagueZone league ID is supplied, that exact league is authoritative.
 * Global environment/default-league fallbacks are only allowed when no explicit
 * LeagueZone league context was provided.
 *
 * If only a current league ID is stored (no previous seasons), the function
 * auto-discovers the full history by walking the Sleeper previous_league_id
 * chain. Results are persisted back to the DB so subsequent calls are fast.
 */

import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';

export interface LeagueIdsConfig {
  current: string;
  /** Map of season year string → Sleeper league ID for past seasons. */
  previous: Record<string, string>;
}

export interface LeagueSummary {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  foundedYear: number | null;
}

export interface LeagueHomepageData extends LeagueSummary {
  sleeperLeagueId: string | null;
}

export interface LeagueBranding {
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  rulesContent: string | null;
  rulesFileKey: string | null;
}

export async function getLeagueIdsFromDb(explicitLeagueId?: string): Promise<LeagueIdsConfig> {
  // An environment ID is a legacy/default context only. It must never replace
  // an explicitly selected LeagueZone league.
  if (!explicitLeagueId && process.env.SLEEPER_LEAGUE_ID) {
    return { current: process.env.SLEEPER_LEAGUE_ID, previous: {} };
  }

  try {
    const db = getDb();
    let row: Record<string, unknown> | undefined;

    if (explicitLeagueId) {
      const res = await db.execute(sql`
        SELECT id, sleeper_league_id, sleeper_league_ids
        FROM leagues
        WHERE setup_completed = true
          AND is_active = true
          AND id = ${explicitLeagueId}::uuid
        LIMIT 1
      `);
      row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
      // Exact LeagueZone context requested: do not silently substitute another league.
      if (!row) return { current: '', previous: {} };
    } else {
      const res = await db.execute(sql`
        SELECT id, sleeper_league_id, sleeper_league_ids
        FROM leagues
        WHERE setup_completed = true
          AND is_active = true
        ORDER BY created_at DESC
        LIMIT 1
      `);
      row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    }

    if (!row) return { current: '', previous: {} };

    const current = typeof row.sleeper_league_id === 'string' ? row.sleeper_league_id.trim() : '';
    let allIds = (row.sleeper_league_ids as Record<string, string>) || {};

    let previous: Record<string, string> = {};
    for (const [year, id] of Object.entries(allIds)) {
      if (id && id !== current) previous[year] = id;
    }

    if (current && Object.keys(previous).length === 0) {
      try {
        const { discoverLeagueChain } = await import('@/lib/utils/sleeper-api');
        const chain = await discoverLeagueChain(current);
        const newPrevious: Record<string, string> = {};
        for (const [year, id] of Object.entries(chain)) {
          if (id !== current) newPrevious[year] = id;
        }
        if (Object.keys(newPrevious).length > 0) {
          previous = newPrevious;
          allIds = { ...allIds, ...chain };
          const leagueRowId = row.id as string;
          if (leagueRowId) {
            await db.execute(sql`
              UPDATE leagues
              SET sleeper_league_ids = ${JSON.stringify(allIds)}::jsonb,
                  updated_at = now()
              WHERE id = ${leagueRowId}::uuid
            `).catch(() => { /* non-fatal */ });
          }
        }
      } catch {
        // Non-fatal: current-season data remains usable.
      }
    }

    return { current, previous };
  } catch {
    return { current: '', previous: {} };
  }
}

export async function getAllLeagues(): Promise<LeagueSummary[]> {
  try {
    const db = getDb();
    const res = await db.execute(sql`
      SELECT id, slug, name, short_name, logo_url, primary_color, secondary_color, founded_year
      FROM leagues
      WHERE setup_completed = true
        AND is_active = true
      ORDER BY created_at ASC
    `);
    const rows = (res as { rows?: Array<Record<string, unknown>> }).rows ?? [];
    return rows.map((r) => ({
      id: r.id as string,
      slug: (r.slug as string) || '',
      name: (r.name as string) || '',
      shortName: (r.short_name as string | null) ?? null,
      logoUrl: (r.logo_url as string | null) ?? null,
      primaryColor: (r.primary_color as string | null) ?? null,
      secondaryColor: (r.secondary_color as string | null) ?? null,
      foundedYear: (r.founded_year as number | null) ?? null,
    }));
  } catch {
    return [];
  }
}

export async function getLeagueBySlug(slug: string): Promise<LeagueHomepageData | null> {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) return null;

  try {
    const db = getDb();
    const res = await db.execute(sql`
      SELECT id, slug, name, short_name, logo_url, primary_color, secondary_color, founded_year, sleeper_league_id
      FROM leagues
      WHERE setup_completed = true
        AND is_active = true
        AND slug = ${normalizedSlug}
      LIMIT 1
    `);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    if (!row) return null;

    return {
      id: row.id as string,
      slug: (row.slug as string) || normalizedSlug,
      name: (row.name as string) || '',
      shortName: (row.short_name as string | null) ?? null,
      logoUrl: (row.logo_url as string | null) ?? null,
      primaryColor: (row.primary_color as string | null) ?? null,
      secondaryColor: (row.secondary_color as string | null) ?? null,
      foundedYear: (row.founded_year as number | null) ?? null,
      sleeperLeagueId: (row.sleeper_league_id as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export interface DiscordWebhooks {
  suggestions: string | null;
  trades: string | null;
  tradeBlock: string | null;
}

/** Read Discord webhook URLs for the active league.
 *  Priority: DB (leagues.config.discordWebhooks) → env vars.
 *  This lets commissioners configure webhooks via the settings UI without
 *  needing access to server env vars. */
export async function getDiscordWebhooks(leagueId?: string): Promise<DiscordWebhooks> {
  const envFallback: DiscordWebhooks = {
    suggestions: process.env.DISCORD_SUGGESTIONS_WEBHOOK_URL || null,
    trades: process.env.DISCORD_TRADES_WEBHOOK_URL || null,
    tradeBlock: process.env.DISCORD_TRADE_BLOCK_WEBHOOK_URL || null,
  };
  try {
    const db = getDb();
    const res = leagueId
      ? await db.execute(sql`SELECT config FROM leagues WHERE setup_completed = true AND id = ${leagueId}::uuid LIMIT 1`)
      : await db.execute(sql`SELECT config FROM leagues WHERE setup_completed = true ORDER BY created_at DESC LIMIT 1`);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    if (!row) return envFallback;
    const config = (row.config as Record<string, unknown>) ?? {};
    const stored = (config.discordWebhooks as Partial<DiscordWebhooks>) ?? {};
    return {
      suggestions: (stored.suggestions as string | null | undefined) || envFallback.suggestions,
      trades: (stored.trades as string | null | undefined) || envFallback.trades,
      tradeBlock: (stored.tradeBlock as string | null | undefined) || envFallback.tradeBlock,
    };
  } catch {
    return envFallback;
  }
}

export async function getLeagueBranding(leagueId?: string): Promise<LeagueBranding> {
  const fallback: LeagueBranding = {
    name: '',
    shortName: null,
    logoUrl: null,
    primaryColor: null,
    secondaryColor: null,
    rulesContent: null,
    rulesFileKey: null,
  };
  try {
    const db = getDb();
    const defaultBrandingQuery = sql`
      SELECT name, short_name, logo_url, primary_color, secondary_color, rules_content, rules_file_key
      FROM leagues
      WHERE setup_completed = true
      ORDER BY created_at DESC
      LIMIT 1
    `;

    let row: Record<string, unknown> | undefined;
    if (leagueId) {
      const res = await db.execute(sql`
        SELECT name, short_name, logo_url, primary_color, secondary_color, rules_content, rules_file_key
        FROM leagues
        WHERE setup_completed = true
          AND id = ${leagueId}::uuid
        LIMIT 1
      `);
      row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    }

    if (!row) {
      const res = await db.execute(defaultBrandingQuery);
      row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    }
    if (!row) return fallback;
    return {
      name: (row.name as string) || '',
      shortName: (row.short_name as string | null) ?? null,
      logoUrl: (row.logo_url as string | null) ?? null,
      primaryColor: (row.primary_color as string | null) ?? null,
      secondaryColor: (row.secondary_color as string | null) ?? null,
      rulesContent: (row.rules_content as string | null) ?? null,
      rulesFileKey: (row.rules_file_key as string | null) ?? null,
    };
  } catch {
    return fallback;
  }
}
