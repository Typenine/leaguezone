import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { normalizeBrandPalette, type BrandPalette } from '@/lib/branding/colors';

export type FranchiseBrandSnapshot = {
  franchiseKey: string;
  season: number;
  rosterId: number | null;
  sleeperOwnerId: string | null;
  teamName: string;
  abbreviation: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  tertiaryColor: string | null;
  quaternaryColor: string | null;
};

type SleeperRoster = {
  roster_id?: number;
  owner_id?: string | null;
  metadata?: { team_name?: string | null } | null;
};

type SleeperUser = {
  user_id?: string | null;
  username?: string | null;
  display_name?: string | null;
  metadata?: { team_name?: string | null } | null;
};

type StoredTeam = {
  rosterId?: number;
  teamName?: string;
  ownerId?: string;
};

function franchiseKey(rosterId: number): string {
  return `roster:${rosterId}`;
}

function abbreviation(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return name.slice(0, 4).toUpperCase();
  return words.slice(0, 4).map((word) => word[0]?.toUpperCase()).join('');
}

export function currentSeasonFromLeague(params: {
  sleeperLeagueId?: string | null;
  sleeperLeagueIds?: Record<string, string> | null;
}): number {
  const entries = Object.entries(params.sleeperLeagueIds || {});
  const match = entries.find(([, id]) => id === params.sleeperLeagueId);
  const parsed = Number(match?.[0]);
  return Number.isFinite(parsed) ? parsed : new Date().getUTCFullYear();
}

export async function getFranchiseBrandHistory(params: {
  leagueId: string;
  season?: number;
}): Promise<FranchiseBrandSnapshot[]> {
  try {
    const db = getDb();
    const res = params.season == null
      ? await db.execute(sql`
          SELECT franchise_key, season, roster_id, sleeper_owner_id, team_name, abbreviation,
                 logo_url, primary_color, secondary_color, tertiary_color, quaternary_color
          FROM franchise_brand_history
          WHERE league_id = ${params.leagueId}::uuid
          ORDER BY season DESC, roster_id ASC NULLS LAST
        `)
      : await db.execute(sql`
          SELECT franchise_key, season, roster_id, sleeper_owner_id, team_name, abbreviation,
                 logo_url, primary_color, secondary_color, tertiary_color, quaternary_color
          FROM franchise_brand_history
          WHERE league_id = ${params.leagueId}::uuid AND season = ${params.season}
          ORDER BY roster_id ASC NULLS LAST
        `);
    const rows = (res as { rows?: Array<Record<string, unknown>> }).rows || [];
    return rows.map((row) => ({
      franchiseKey: String(row.franchise_key),
      season: Number(row.season),
      rosterId: row.roster_id == null ? null : Number(row.roster_id),
      sleeperOwnerId: row.sleeper_owner_id ? String(row.sleeper_owner_id) : null,
      teamName: String(row.team_name),
      abbreviation: row.abbreviation ? String(row.abbreviation) : null,
      logoUrl: row.logo_url ? String(row.logo_url) : null,
      primaryColor: row.primary_color ? String(row.primary_color) : null,
      secondaryColor: row.secondary_color ? String(row.secondary_color) : null,
      tertiaryColor: row.tertiary_color ? String(row.tertiary_color) : null,
      quaternaryColor: row.quaternary_color ? String(row.quaternary_color) : null,
    }));
  } catch {
    return [];
  }
}

export async function resolveLeagueSeasonForSleeperId(sleeperLeagueId: string): Promise<{ leagueId: string; season: number; isCurrent: boolean } | null> {
  try {
    const db = getDb();
    const res = await db.execute(sql`
      SELECT id::text AS id, sleeper_league_id, sleeper_league_ids
      FROM leagues
      WHERE setup_completed = true AND (
        sleeper_league_id = ${sleeperLeagueId}
        OR EXISTS (
          SELECT 1 FROM jsonb_each_text(COALESCE(sleeper_league_ids, '{}'::jsonb)) AS e
          WHERE e.value = ${sleeperLeagueId}
        )
      )
      LIMIT 1
    `);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    if (!row) return null;
    const ids = (row.sleeper_league_ids as Record<string, string> | null) || {};
    const seasonEntry = Object.entries(ids).find(([, id]) => id === sleeperLeagueId);
    const season = Number(seasonEntry?.[0]);
    return {
      leagueId: String(row.id),
      season: Number.isFinite(season) ? season : new Date().getUTCFullYear(),
      isCurrent: String(row.sleeper_league_id || '') === sleeperLeagueId,
    };
  } catch {
    return null;
  }
}

export async function upsertFranchiseBrandSnapshot(params: {
  leagueId: string;
  season: number;
  rosterId: number;
  sleeperOwnerId?: string | null;
  teamName: string;
  abbreviation?: string | null;
  logoUrl?: string | null;
  palette?: BrandPalette | null;
  source?: string;
}): Promise<void> {
  const palette = params.palette ? normalizeBrandPalette(params.palette) : null;
  const db = getDb();
  await db.execute(sql`
    INSERT INTO franchise_brand_history (
      league_id, franchise_key, season, roster_id, sleeper_owner_id, team_name, abbreviation,
      logo_url, primary_color, secondary_color, tertiary_color, quaternary_color, source, updated_at
    ) VALUES (
      ${params.leagueId}::uuid,
      ${franchiseKey(params.rosterId)},
      ${params.season},
      ${params.rosterId},
      ${params.sleeperOwnerId || null},
      ${params.teamName},
      ${params.abbreviation || abbreviation(params.teamName)},
      ${params.logoUrl || null},
      ${palette?.primary || null},
      ${palette?.secondary || null},
      ${palette?.tertiary || null},
      ${palette?.quaternary || null},
      ${params.source || 'leaguezone'},
      now()
    )
    ON CONFLICT (league_id, franchise_key, season) DO UPDATE SET
      roster_id = EXCLUDED.roster_id,
      sleeper_owner_id = EXCLUDED.sleeper_owner_id,
      team_name = CASE
        WHEN franchise_brand_history.source = 'commissioner' AND EXCLUDED.source = 'sleeper-sync'
          THEN franchise_brand_history.team_name
        ELSE EXCLUDED.team_name
      END,
      abbreviation = CASE
        WHEN franchise_brand_history.source = 'commissioner' AND EXCLUDED.source = 'sleeper-sync'
          THEN franchise_brand_history.abbreviation
        ELSE COALESCE(EXCLUDED.abbreviation, franchise_brand_history.abbreviation)
      END,
      logo_url = COALESCE(EXCLUDED.logo_url, franchise_brand_history.logo_url),
      primary_color = COALESCE(EXCLUDED.primary_color, franchise_brand_history.primary_color),
      secondary_color = COALESCE(EXCLUDED.secondary_color, franchise_brand_history.secondary_color),
      tertiary_color = COALESCE(EXCLUDED.tertiary_color, franchise_brand_history.tertiary_color),
      quaternary_color = COALESCE(EXCLUDED.quaternary_color, franchise_brand_history.quaternary_color),
      source = CASE
        WHEN franchise_brand_history.source = 'commissioner' AND EXCLUDED.source = 'sleeper-sync'
          THEN franchise_brand_history.source
        ELSE EXCLUDED.source
      END,
      updated_at = now()
  `);
}

export async function updateFranchiseBrandSnapshot(params: {
  leagueId: string;
  season: number;
  franchiseKey: string;
  teamName: string;
  abbreviation?: string | null;
  logoUrl?: string | null;
  palette: BrandPalette;
}): Promise<boolean> {
  const palette = normalizeBrandPalette(params.palette);
  if (!palette) return false;
  const db = getDb();
  const res = await db.execute(sql`
    UPDATE franchise_brand_history SET
      team_name = ${params.teamName},
      abbreviation = ${params.abbreviation || abbreviation(params.teamName)},
      logo_url = ${params.logoUrl || null},
      primary_color = ${palette.primary},
      secondary_color = ${palette.secondary},
      tertiary_color = ${palette.tertiary || null},
      quaternary_color = ${palette.quaternary || null},
      source = 'commissioner',
      updated_at = now()
    WHERE league_id = ${params.leagueId}::uuid
      AND season = ${params.season}
      AND franchise_key = ${params.franchiseKey}
    RETURNING id
  `);
  return ((res as { rows?: unknown[] }).rows?.length || 0) > 0;
}

export async function syncFranchiseBrandHistory(params: {
  leagueId: string;
  currentSleeperLeagueId?: string | null;
  sleeperLeagueIds: Record<string, string>;
  config?: Record<string, unknown> | null;
  teamColors?: Record<string, unknown> | null;
}): Promise<{ seasons: number; snapshots: number; errors: number }> {
  const config = params.config || {};
  const storedTeams = Array.isArray(config.teams) ? config.teams as StoredTeam[] : [];
  const teamLogos = (config.teamLogos as Record<string, string | null> | undefined) || {};
  const teamColors = params.teamColors || {};
  const ids = { ...params.sleeperLeagueIds };
  if (params.currentSleeperLeagueId && !Object.values(ids).includes(params.currentSleeperLeagueId)) {
    ids[String(new Date().getUTCFullYear())] = params.currentSleeperLeagueId;
  }

  let snapshots = 0;
  let errors = 0;
  for (const [seasonRaw, sleeperLeagueId] of Object.entries(ids)) {
    const season = Number(seasonRaw);
    if (!Number.isFinite(season) || !sleeperLeagueId) continue;
    try {
      const [rostersRes, usersRes] = await Promise.all([
        fetch(`https://api.sleeper.app/v1/league/${encodeURIComponent(sleeperLeagueId)}/rosters`, { signal: AbortSignal.timeout(8000) }),
        fetch(`https://api.sleeper.app/v1/league/${encodeURIComponent(sleeperLeagueId)}/users`, { signal: AbortSignal.timeout(8000) }),
      ]);
      if (!rostersRes.ok) throw new Error(`Sleeper rosters ${rostersRes.status}`);
      const rosters = await rostersRes.json() as SleeperRoster[];
      const users = usersRes.ok ? await usersRes.json() as SleeperUser[] : [];
      const usersById = new Map(users.filter((u) => u.user_id).map((u) => [String(u.user_id), u]));
      const isCurrent = sleeperLeagueId === params.currentSleeperLeagueId;

      for (const roster of rosters) {
        const rosterId = Number(roster.roster_id);
        if (!Number.isFinite(rosterId)) continue;
        const ownerId = roster.owner_id ? String(roster.owner_id) : null;
        const user = ownerId ? usersById.get(ownerId) : undefined;
        const fallbackStored = storedTeams.find((team) => Number(team.rosterId) === rosterId);
        const teamName = (
          user?.metadata?.team_name
          || roster.metadata?.team_name
          || user?.display_name
          || user?.username
          || fallbackStored?.teamName
          || `Team ${rosterId}`
        ).trim();
        const palette = isCurrent ? normalizeBrandPalette(teamColors[teamName]) : null;
        const logoUrl = isCurrent ? (teamLogos[teamName] || null) : null;
        await upsertFranchiseBrandSnapshot({
          leagueId: params.leagueId,
          season,
          rosterId,
          sleeperOwnerId: ownerId,
          teamName,
          logoUrl,
          palette,
          source: 'sleeper-sync',
        });
        snapshots += 1;
      }
    } catch (error) {
      errors += 1;
      console.warn('[branding/history-sync] season failed', season, error);
    }
  }
  return { seasons: Object.keys(ids).length, snapshots, errors };
}
