import { sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import type { FantasyPlayer, FantasyTeamData } from '@/lib/providers/types';
import type { LeagueProviderSeason } from '@/lib/server/provider-seasons';

function rowsOf(result: unknown): Array<Record<string, unknown>> {
  return (result as { rows?: Array<Record<string, unknown>> }).rows ?? [];
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

async function findOrCreateFranchise(
  season: LeagueProviderSeason,
  team: FantasyTeamData,
): Promise<string> {
  const db = getDb();

  if (team.ownerId) {
    const ownerMatch = await db.execute(sql`
      SELECT pti.franchise_id
      FROM provider_team_identities pti
      JOIN league_provider_seasons lps ON lps.id = pti.league_provider_season_id
      JOIN league_franchises lf ON lf.id = pti.franchise_id
      WHERE lf.league_id = ${season.leagueId}::uuid
        AND lps.provider = ${season.provider}
        AND pti.owner_provider_id = ${team.ownerId}
      ORDER BY lps.season DESC
      LIMIT 1
    `).catch(() => null);
    const row = ownerMatch ? rowsOf(ownerMatch)[0] : null;
    if (row?.franchise_id) return String(row.franchise_id);
  }

  const normalized = normalizeName(team.teamName);
  const nameMatch = await db.execute(sql`
    SELECT id
    FROM league_franchises
    WHERE league_id = ${season.leagueId}::uuid
      AND lower(regexp_replace(trim(display_name), '\\s+', ' ', 'g')) = ${normalized}
    ORDER BY created_at ASC
    LIMIT 2
  `).catch(() => null);
  const nameRows = nameMatch ? rowsOf(nameMatch) : [];
  if (nameRows.length === 1 && nameRows[0]?.id) return String(nameRows[0].id);

  const inserted = await db.execute(sql`
    INSERT INTO league_franchises (league_id, display_name, metadata, created_at, updated_at)
    VALUES (${season.leagueId}::uuid, ${team.teamName}, ${JSON.stringify({ source: 'provider-sync' })}::jsonb, now(), now())
    RETURNING id
  `);
  const id = rowsOf(inserted)[0]?.id;
  if (!id) throw new Error('Failed to create LeagueZone franchise identity.');
  return String(id);
}

async function mapTeamIdentity(season: LeagueProviderSeason, team: FantasyTeamData): Promise<string> {
  if (!season.id) throw new Error('Provider season must be persisted before identities can be synchronized.');
  const db = getDb();
  const existing = await db.execute(sql`
    SELECT franchise_id
    FROM provider_team_identities
    WHERE league_provider_season_id = ${season.id}::uuid
      AND provider_team_id = ${team.providerTeamId}
    LIMIT 1
  `).catch(() => null);
  const existingId = existing ? rowsOf(existing)[0]?.franchise_id : null;
  if (existingId) return String(existingId);

  const franchiseId = await findOrCreateFranchise(season, team);
  await db.execute(sql`
    INSERT INTO provider_team_identities (
      league_provider_season_id, franchise_id, provider_team_id, roster_id,
      owner_provider_id, team_name_snapshot, metadata, created_at, updated_at
    ) VALUES (
      ${season.id}::uuid, ${franchiseId}::uuid, ${team.providerTeamId}, ${team.rosterId},
      ${team.ownerId || null}, ${team.teamName}, ${JSON.stringify({ provider: season.provider })}::jsonb, now(), now()
    )
    ON CONFLICT (league_provider_season_id, provider_team_id)
    DO UPDATE SET roster_id = EXCLUDED.roster_id,
                  owner_provider_id = EXCLUDED.owner_provider_id,
                  team_name_snapshot = EXCLUDED.team_name_snapshot,
                  updated_at = now()
  `);
  return franchiseId;
}

async function findOrCreatePlayer(player: FantasyPlayer): Promise<string> {
  const db = getDb();
  const external = await db.execute(sql`
    SELECT fantasy_player_id
    FROM fantasy_player_external_ids
    WHERE provider = ${player.provider} AND provider_player_id = ${player.providerPlayerId}
    LIMIT 1
  `).catch(() => null);
  const existingId = external ? rowsOf(external)[0]?.fantasy_player_id : null;
  if (existingId) return String(existingId);

  const normalized = normalizeName(player.fullName);
  const candidates = await db.execute(sql`
    SELECT id, nfl_team
    FROM fantasy_players
    WHERE lower(regexp_replace(trim(canonical_name), '\\s+', ' ', 'g')) = ${normalized}
      AND COALESCE(position, '') = COALESCE(${player.position}, '')
    ORDER BY created_at ASC
    LIMIT 3
  `).catch(() => null);
  const candidateRows = candidates ? rowsOf(candidates) : [];
  let playerId: string | null = null;
  if (candidateRows.length === 1 && candidateRows[0]?.id) {
    playerId = String(candidateRows[0].id);
  } else if (player.nflTeam) {
    const exactTeam = candidateRows.filter((row) => String(row.nfl_team || '') === player.nflTeam);
    if (exactTeam.length === 1 && exactTeam[0]?.id) playerId = String(exactTeam[0].id);
  }

  if (!playerId) {
    const inserted = await db.execute(sql`
      INSERT INTO fantasy_players (canonical_name, position, nfl_team, metadata, created_at, updated_at)
      VALUES (${player.fullName}, ${player.position}, ${player.nflTeam}, ${JSON.stringify({ source: player.provider })}::jsonb, now(), now())
      RETURNING id
    `);
    const id = rowsOf(inserted)[0]?.id;
    if (!id) throw new Error('Failed to create LeagueZone player identity.');
    playerId = String(id);
  }

  await db.execute(sql`
    INSERT INTO fantasy_player_external_ids (fantasy_player_id, provider, provider_player_id, metadata, created_at, updated_at)
    VALUES (${playerId}::uuid, ${player.provider}, ${player.providerPlayerId}, '{}'::jsonb, now(), now())
    ON CONFLICT (provider, provider_player_id)
    DO UPDATE SET fantasy_player_id = EXCLUDED.fantasy_player_id, updated_at = now()
  `);
  return playerId;
}

export type ProviderIdentityMaps = {
  franchiseByRosterId: Record<number, string>;
  leaguePlayerByProviderPlayerId: Record<string, string>;
};

export async function syncProviderIdentities(
  season: LeagueProviderSeason,
  teams: FantasyTeamData[],
  players: Record<string, FantasyPlayer>,
): Promise<ProviderIdentityMaps> {
  const franchiseByRosterId: Record<number, string> = {};
  const leaguePlayerByProviderPlayerId: Record<string, string> = {};
  if (!season.id) return { franchiseByRosterId, leaguePlayerByProviderPlayerId };

  for (const team of teams) {
    try { franchiseByRosterId[team.rosterId] = await mapTeamIdentity(season, team); } catch {}
  }
  for (const player of Object.values(players)) {
    try { leaguePlayerByProviderPlayerId[player.playerId] = await findOrCreatePlayer(player); } catch {}
  }
  return { franchiseByRosterId, leaguePlayerByProviderPlayerId };
}

export async function resolveLeaguePlayerId(provider: string, providerPlayerId: string): Promise<string | null> {
  const db = getDb();
  const result = await db.execute(sql`
    SELECT fantasy_player_id FROM fantasy_player_external_ids
    WHERE provider = ${provider} AND provider_player_id = ${providerPlayerId}
    LIMIT 1
  `).catch(() => null);
  const id = result ? rowsOf(result)[0]?.fantasy_player_id : null;
  return id ? String(id) : null;
}

export type FranchiseIdentityRow = {
  franchiseId: string;
  displayName: string;
  season: number;
  provider: string;
  providerTeamId: string;
  rosterId: number;
  ownerProviderId: string | null;
  teamName: string;
};

export async function listLeagueFranchiseIdentities(leagueId: string): Promise<FranchiseIdentityRow[]> {
  const db = getDb();
  const result = await db.execute(sql`
    SELECT lf.id::text AS franchise_id, lf.display_name, lps.season, lps.provider,
           pti.provider_team_id, pti.roster_id, pti.owner_provider_id, pti.team_name_snapshot
    FROM provider_team_identities pti
    JOIN league_provider_seasons lps ON lps.id = pti.league_provider_season_id
    JOIN league_franchises lf ON lf.id = pti.franchise_id
    WHERE lf.league_id = ${leagueId}::uuid
    ORDER BY lps.season DESC, pti.roster_id ASC
  `);
  return rowsOf(result).map((row) => ({
    franchiseId: String(row.franchise_id),
    displayName: String(row.display_name),
    season: Number(row.season),
    provider: String(row.provider),
    providerTeamId: String(row.provider_team_id),
    rosterId: Number(row.roster_id),
    ownerProviderId: row.owner_provider_id ? String(row.owner_provider_id) : null,
    teamName: String(row.team_name_snapshot),
  }));
}

export async function mergeLeagueFranchises(
  leagueId: string,
  sourceFranchiseId: string,
  targetFranchiseId: string,
): Promise<void> {
  if (!sourceFranchiseId || !targetFranchiseId || sourceFranchiseId === targetFranchiseId) {
    throw new Error('Choose two different franchises to merge.');
  }
  const db = getDb();
  const validation = await db.execute(sql`
    SELECT id::text AS id FROM league_franchises
    WHERE league_id = ${leagueId}::uuid
      AND id IN (${sourceFranchiseId}::uuid, ${targetFranchiseId}::uuid)
  `);
  const validIds = new Set(rowsOf(validation).map((row) => String(row.id)));
  if (!validIds.has(sourceFranchiseId) || !validIds.has(targetFranchiseId)) {
    throw new Error('Franchise mapping is not part of this league.');
  }
  await db.execute(sql`
    UPDATE provider_team_identities
    SET franchise_id = ${targetFranchiseId}::uuid, updated_at = now()
    WHERE franchise_id = ${sourceFranchiseId}::uuid
  `);
  await db.execute(sql`
    DELETE FROM league_franchises
    WHERE id = ${sourceFranchiseId}::uuid
      AND league_id = ${leagueId}::uuid
      AND NOT EXISTS (SELECT 1 FROM provider_team_identities WHERE franchise_id = ${sourceFranchiseId}::uuid)
  `);
}
