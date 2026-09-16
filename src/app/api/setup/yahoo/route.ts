import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { getYahooLeagueTeams, getYahooLeagues, isYahooAvailable } from '@/lib/providers/yahoo';
import { findLinkedYahooLeagueHistory } from '@/lib/providers/yahoo-history';
import { getFreshYahooAccessToken } from '@/lib/server/provider-accounts';
import { resolveOwnedSetupLeagueId } from '@/lib/server/setup-league-context';
import { requireUser } from '@/lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function rowsOf(result: unknown): Array<Record<string, unknown>> {
  return (result as { rows?: Array<Record<string, unknown>> }).rows ?? [];
}

function inviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i += 1) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

export async function POST(request: NextRequest) {
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (!isYahooAvailable()) return NextResponse.json({ error: 'Yahoo Fantasy integration is not enabled.' }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }

  const providerLeagueId = typeof body.providerLeagueId === 'string' ? body.providerLeagueId.trim() : '';
  const bodyLeagueId = typeof body.leagueId === 'string' ? body.leagueId : null;
  if (!providerLeagueId) return NextResponse.json({ error: 'Choose a Yahoo league to import.' }, { status: 400 });

  const leagueId = await resolveOwnedSetupLeagueId(session.userId, bodyLeagueId);
  if (!leagueId) return NextResponse.json({ error: 'No league found. Please restart setup.' }, { status: 400 });

  try {
    const token = await getFreshYahooAccessToken(session.userId);
    const availableLeagues = await getYahooLeagues(token);
    const providerLeague = availableLeagues.find((league) => league.providerLeagueId === providerLeagueId);
    if (!providerLeague) return NextResponse.json({ error: 'That Yahoo league is not available to your connected account.' }, { status: 403 });

    const teams = await getYahooLeagueTeams(token, providerLeagueId);
    if (teams.length === 0) return NextResponse.json({ error: 'Yahoo returned no teams for that league.' }, { status: 422 });
    const currentUserTeam = teams.find((team) => team.isCurrentUser);
    if (!currentUserTeam?.isCommissioner) {
      return NextResponse.json({ error: 'Only a Yahoo league commissioner can import that league into LeagueZone.' }, { status: 403 });
    }

    const linkedHistory = findLinkedYahooLeagueHistory(providerLeague, availableLeagues);
    const db = getDb();
    const existingResult = await db.execute(sql`
      SELECT id, season, provider, provider_league_id, is_current
      FROM league_provider_seasons
      WHERE league_id = ${leagueId}::uuid
    `);
    const existingBySeason = new Map(
      rowsOf(existingResult).map((row) => [Number(row.season), row] as const),
    );
    const selectedExisting = existingBySeason.get(providerLeague.season);
    if (selectedExisting && (
      String(selectedExisting.provider) !== 'yahoo'
      || String(selectedExisting.provider_league_id) !== providerLeague.providerLeagueId
    )) {
      return NextResponse.json({
        error: `The ${providerLeague.season} LeagueZone season is already linked to another provider season. Yahoo import will not replace existing league history.`,
      }, { status: 409 });
    }

    const importableHistory = linkedHistory.filter((linked) => {
      const existing = existingBySeason.get(linked.season);
      if (!existing) return true;
      return String(existing.provider) === 'yahoo'
        && String(existing.provider_league_id) === linked.providerLeagueId;
    });
    const skippedSeasons = linkedHistory
      .filter((linked) => !importableHistory.includes(linked))
      .map((linked) => linked.season);

    let currentProviderSeasonId: string | null = null;
    for (const linked of importableHistory) {
      const isSelected = linked.providerLeagueId === providerLeague.providerLeagueId;
      const result = await db.execute(sql`
        INSERT INTO league_provider_seasons (
          league_id, season, provider, provider_league_id, provider_game_id, is_current,
          metadata, last_synced_at, created_at, updated_at
        ) VALUES (
          ${leagueId}::uuid, ${linked.season}, 'yahoo', ${linked.providerLeagueId}, ${linked.providerGameId}, false,
          ${JSON.stringify(linked.metadata || {})}::jsonb, now(), now(), now()
        )
        ON CONFLICT (league_id, season) DO UPDATE SET
          provider_game_id = EXCLUDED.provider_game_id,
          metadata = EXCLUDED.metadata,
          last_synced_at = now(),
          updated_at = now()
        WHERE league_provider_seasons.provider = 'yahoo'
          AND league_provider_seasons.provider_league_id = EXCLUDED.provider_league_id
        RETURNING id
      `);
      const seasonId = rowsOf(result)[0]?.id ? String(rowsOf(result)[0].id) : null;
      if (!seasonId) continue;
      if (isSelected) currentProviderSeasonId = seasonId;
      await db.execute(sql`
        INSERT INTO provider_league_snapshots (league_provider_season_id, snapshot_type, payload, fetched_at)
        VALUES (${seasonId}::uuid, 'league', ${JSON.stringify(linked)}::jsonb, now())
        ON CONFLICT (league_provider_season_id, snapshot_type) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = now()
      `);
    }
    if (!currentProviderSeasonId) throw new Error('Provider season mapping was not created.');

    await db.execute(sql`
      UPDATE league_provider_seasons
      SET is_current = (id = ${currentProviderSeasonId}::uuid), updated_at = now()
      WHERE league_id = ${leagueId}::uuid
    `);

    await db.execute(sql`
      INSERT INTO provider_league_snapshots (league_provider_season_id, snapshot_type, payload, fetched_at)
      VALUES (${currentProviderSeasonId}::uuid, 'teams', ${JSON.stringify(teams)}::jsonb, now())
      ON CONFLICT (league_provider_season_id, snapshot_type) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = now()
    `);

    const setupTeams = teams.map((team) => ({
      rosterId: team.rosterId,
      providerTeamId: team.providerTeamId,
      ownerName: team.ownerName,
      teamName: team.teamName,
      logoUrl: team.logoUrl,
    }));

    await db.execute(sql`
      UPDATE leagues SET
        config = jsonb_set(
          jsonb_set(
            jsonb_set(
              COALESCE(config, '{}'::jsonb),
              '{completedSetupSteps}',
              CASE
                WHEN COALESCE(config->'completedSetupSteps', '[]'::jsonb) ? 'sleeper'
                  THEN COALESCE(config->'completedSetupSteps', '[]'::jsonb)
                ELSE COALESCE(config->'completedSetupSteps', '[]'::jsonb) || '["sleeper"]'::jsonb
              END
            ),
            '{teams}', ${JSON.stringify(setupTeams)}::jsonb
          ),
          '{provider}', '"yahoo"'::jsonb
        ),
        updated_at = now()
      WHERE id = ${leagueId}::uuid
    `);

    await db.execute(sql`DELETE FROM league_invites WHERE league_id = ${leagueId}::uuid AND claimed_at IS NULL`);
    for (const team of setupTeams) {
      await db.execute(sql`
        INSERT INTO league_invites (league_id, team_name, roster_id, invite_code)
        VALUES (${leagueId}::uuid, ${team.teamName}, ${team.rosterId}, ${inviteCode()})
      `);
    }

    return NextResponse.json({
      success: true,
      leagueId,
      provider: 'yahoo',
      season: providerLeague.season,
      importedSeasons: importableHistory.map((league) => league.season),
      skippedSeasons,
      teams: setupTeams.length,
    });
  } catch (error) {
    console.error('[setup/yahoo] Import failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Failed to import Yahoo league data.' }, { status: 502 });
  }
}
