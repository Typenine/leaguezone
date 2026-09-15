import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { requireUser } from '@/lib/server/session';
import { requireSetupLeagueOwnership } from '@/lib/server/setup-ownership';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
        { status: 400 }
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

    await db.execute(sql`
      UPDATE leagues SET
        sleeper_league_id = ${normalizedCurrentId},
        sleeper_league_ids = ${JSON.stringify(normalizedLeagueIds)}::jsonb,
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

    for (const [season, providerLeagueId] of Object.entries(normalizedLeagueIds)) {
      const seasonNumber = Number.parseInt(season, 10);
      const isCurrent = providerLeagueId === normalizedCurrentId;
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
          provider = 'sleeper',
          provider_league_id = EXCLUDED.provider_league_id,
          provider_game_id = NULL,
          is_current = EXCLUDED.is_current,
          metadata = EXCLUDED.metadata,
          last_synced_at = now(),
          updated_at = now()
      `);
    }

    // Re-submitting setup should not accumulate stale, unclaimed invites.
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

    return NextResponse.json({ success: true, leagueId });
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
