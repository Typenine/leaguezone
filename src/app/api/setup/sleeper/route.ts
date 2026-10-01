import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { requireUser } from '@/lib/server/session';
import { requireSetupLeagueOwnership } from '@/lib/server/setup-ownership';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function rowsOf(result: unknown): Array<Record<string, unknown>> {
  return (result as { rows?: Array<Record<string, unknown>> }).rows ?? [];
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireUser();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    const { userId } = session;

    const body = await request.json();
    const { sleeperLeagueId, sleeperLeagueIds, teams, leagueId: bodyLeagueId } = body;

    if (typeof sleeperLeagueId !== 'string' || !sleeperLeagueId.trim()) {
      return NextResponse.json({ error: 'Sleeper League ID is required' }, { status: 400 });
    }
    if (!Array.isArray(teams) || teams.length === 0) {
      return NextResponse.json({ error: 'Sleeper league teams are required' }, { status: 400 });
    }

    const jar = await cookies();
    const leagueId =
      (typeof bodyLeagueId === 'string' ? bodyLeagueId : null) ||
      jar.get('setup_league_id')?.value ||
      jar.get('active_league_id')?.value ||
      null;

    if (!leagueId) {
      return NextResponse.json(
        { error: 'No league found. Please start setup from the beginning.' },
        { status: 400 },
      );
    }

    const db = getDb();
    const owned = await requireSetupLeagueOwnership(userId, leagueId);
    if (!owned) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    const normalizedCurrentId = sleeperLeagueId.trim();
    const normalizedLeagueIds: Record<string, string> = {};
    if (sleeperLeagueIds && typeof sleeperLeagueIds === 'object' && !Array.isArray(sleeperLeagueIds)) {
      for (const [season, providerLeagueId] of Object.entries(sleeperLeagueIds as Record<string, unknown>)) {
        if (/^\d{4}$/.test(season) && typeof providerLeagueId === 'string' && providerLeagueId.trim()) {
          normalizedLeagueIds[season] = providerLeagueId.trim();
        }
      }
    }

    const currentSeasonEntry = Object.entries(normalizedLeagueIds)
      .find(([, providerLeagueId]) => providerLeagueId === normalizedCurrentId);
    if (!currentSeasonEntry) {
      return NextResponse.json(
        { error: 'The current Sleeper league must include its season mapping.' },
        { status: 400 },
      );
    }
    const currentSeason = Number.parseInt(currentSeasonEntry[0], 10);

    const existingResult = await db.execute(sql`
      SELECT id, season, provider, provider_league_id, is_current
      FROM league_provider_seasons
      WHERE league_id = ${leagueId}::uuid
    `);
    const existingBySeason = new Map(
      rowsOf(existingResult).map((row) => [Number(row.season), row] as const),
    );

    const currentExisting = existingBySeason.get(currentSeason);
    if (currentExisting && (
      String(currentExisting.provider) !== 'sleeper'
      || String(currentExisting.provider_league_id) !== normalizedCurrentId
    )) {
      return NextResponse.json(
        {
          error: `The ${currentSeason} LeagueZone season is already linked to another provider season. Sleeper import will not replace existing league history.`,
        },
        { status: 409 },
      );
    }

    const importableEntries = Object.entries(normalizedLeagueIds).filter(([season, providerLeagueId]) => {
      const existing = existingBySeason.get(Number.parseInt(season, 10));
      if (!existing) return true;
      return String(existing.provider) === 'sleeper'
        && String(existing.provider_league_id) === providerLeagueId;
    });
    const importableLeagueIds = Object.fromEntries(importableEntries);
    const skippedSeasons = Object.entries(normalizedLeagueIds)
      .filter(([season, providerLeagueId]) => {
        const existing = existingBySeason.get(Number.parseInt(season, 10));
        return Boolean(existing) && !(
          String(existing?.provider) === 'sleeper'
          && String(existing?.provider_league_id) === providerLeagueId
        );
      })
      .map(([season]) => Number.parseInt(season, 10));

    await db.execute(sql`
      UPDATE leagues SET
        sleeper_league_id = ${normalizedCurrentId},
        sleeper_league_ids = ${JSON.stringify(importableLeagueIds)}::jsonb,
        config = jsonb_set(
          jsonb_set(
            jsonb_set(
              COALESCE(config, '{}'::jsonb),
              '{completedSetupSteps}',
              CASE
                WHEN COALESCE(config->'completedSetupSteps', '[]'::jsonb) ? 'provider'
                  THEN COALESCE(config->'completedSetupSteps', '[]'::jsonb)
                ELSE COALESCE(config->'completedSetupSteps', '[]'::jsonb) || '["provider"]'::jsonb
              END
            ),
            '{teams}',
            ${JSON.stringify(teams)}::jsonb
          ),
          '{provider}',
          '"sleeper"'::jsonb
        ),
        updated_at = now()
      WHERE id = ${leagueId}::uuid
    `);

    await db.execute(sql`
      UPDATE league_provider_seasons
      SET is_current = false, updated_at = now()
      WHERE league_id = ${leagueId}::uuid
    `);

    for (const [season, providerLeagueId] of importableEntries) {
      const seasonNumber = Number.parseInt(season, 10);
      const isCurrent = seasonNumber === currentSeason;
      await db.execute(sql`
        INSERT INTO league_provider_seasons (
          league_id,
          season,
          provider,
          provider_league_id,
          is_current,
          metadata,
          last_synced_at,
          created_at,
          updated_at
        ) VALUES (
          ${leagueId}::uuid,
          ${seasonNumber},
          'sleeper',
          ${providerLeagueId},
          ${isCurrent},
          '{"source":"setup"}'::jsonb,
          now(),
          now(),
          now()
        )
        ON CONFLICT (league_id, season) DO UPDATE SET
          is_current = EXCLUDED.is_current,
          metadata = EXCLUDED.metadata,
          last_synced_at = now(),
          updated_at = now()
        WHERE league_provider_seasons.provider = 'sleeper'
          AND league_provider_seasons.provider_league_id = EXCLUDED.provider_league_id
      `);
    }

    await db.execute(sql`
      DELETE FROM league_invites
      WHERE league_id = ${leagueId}::uuid
        AND claimed_at IS NULL
    `);

    for (const team of teams as Array<{ teamName?: unknown; rosterId?: unknown }>) {
      const teamName = typeof team.teamName === 'string' ? team.teamName.trim() : '';
      const rosterId = typeof team.rosterId === 'number' && Number.isInteger(team.rosterId) ? team.rosterId : null;
      if (!teamName) continue;
      const inviteCode = generateInviteCode();
      await db.execute(sql`
        INSERT INTO league_invites (league_id, team_name, roster_id, invite_code)
        VALUES (${leagueId}::uuid, ${teamName}, ${rosterId}, ${inviteCode})
      `);
    }

    return NextResponse.json({
      success: true,
      leagueId,
      provider: 'sleeper',
      season: currentSeason,
      importedSeasons: importableEntries.map(([season]) => Number.parseInt(season, 10)),
      skippedSeasons,
    });
  } catch (error) {
    console.error('[setup/sleeper] Error:', error);
    return NextResponse.json({ error: 'Failed to save Sleeper settings' }, { status: 500 });
  }
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
