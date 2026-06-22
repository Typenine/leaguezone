import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { requireUser } from '@/lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await requireUser();
    if (!session) {
      return NextResponse.json({ error: 'You must be logged in to create a league.' }, { status: 401 });
    }
    const { userId } = session;

    const body = await request.json();
    const { name, slug, shortName, foundedYear, leagueId: existingLeagueId } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
    }

    // Slug validation
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: 'Slug may only contain lowercase letters, numbers, and hyphens.' },
        { status: 400 }
      );
    }

    const db = getDb();
    const jar = await cookies();

    // If updating an existing league the user owns
    if (existingLeagueId) {
      const ownerCheck = await db.execute(sql`
        SELECT id, slug FROM leagues
        WHERE id = ${existingLeagueId}::uuid
          AND commissioner_user_id = ${userId}::uuid
        LIMIT 1
      `);
      const ownerRow = (ownerCheck as { rows?: Array<Record<string, unknown>> }).rows?.[0];
      if (!ownerRow) {
        return NextResponse.json({ error: 'League not found or access denied.' }, { status: 403 });
      }

      // Check slug conflict (another league owns this slug)
      if (slug !== ownerRow.slug) {
        const slugCheck = await db.execute(sql`
          SELECT id FROM leagues WHERE slug = ${slug} AND id != ${existingLeagueId}::uuid LIMIT 1
        `);
        if ((slugCheck as { rows?: unknown[] }).rows?.length) {
          return NextResponse.json({ error: 'That URL slug is already taken.' }, { status: 409 });
        }
      }

      await db.execute(sql`
        UPDATE leagues SET
          name = ${name},
          slug = ${slug},
          short_name = ${shortName || null},
          founded_year = ${foundedYear || null},
          config = jsonb_set(
            COALESCE(config, '{}'),
            '{completedSetupSteps}',
            COALESCE(config->'completedSetupSteps', '[]'::jsonb) || '["league"]'::jsonb
          ),
          updated_at = now()
        WHERE id = ${existingLeagueId}::uuid
      `);

      jar.set('setup_league_id', existingLeagueId, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 });

      return NextResponse.json({ success: true, leagueId: existingLeagueId, updated: true });
    }

    // Creating a new league — check slug conflict first
    const slugCheck = await db.execute(sql`
      SELECT id FROM leagues WHERE slug = ${slug} LIMIT 1
    `);
    if ((slugCheck as { rows?: unknown[] }).rows?.length) {
      return NextResponse.json({ error: 'That URL slug is already taken.' }, { status: 409 });
    }

    const result = await db.execute(sql`
      INSERT INTO leagues (slug, name, short_name, founded_year, commissioner_user_id, config)
      VALUES (
        ${slug},
        ${name},
        ${shortName || null},
        ${foundedYear || null},
        ${userId}::uuid,
        '{"completedSetupSteps": ["league"]}'::jsonb
      )
      RETURNING id
    `);

    const newRow = (result as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    const leagueId = newRow?.id as string;

    // Store the setup league in a short-lived cookie so subsequent setup steps know which league
    jar.set('setup_league_id', leagueId, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 });
    // Also set as active league
    jar.set('active_league_id', leagueId, { httpOnly: false, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });

    return NextResponse.json({ success: true, leagueId, created: true });
  } catch (error) {
    console.error('[setup/league] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to save league';
    const isDbMissing = message.includes('DATABASE_URL') || message.includes('POSTGRES_URL');
    return NextResponse.json(
      { error: isDbMissing ? 'No database configured.' : message },
      { status: 500 }
    );
  }
}
