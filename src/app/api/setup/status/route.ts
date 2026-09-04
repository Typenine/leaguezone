import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { requireUser } from '@/lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);

    // Explicit leagueId takes priority (setup wizard passes this after first step)
    const qLeagueId = url.searchParams.get('leagueId') || null;

    const db = getDb();

    if (qLeagueId) {
      // Verify caller owns this league (or is authenticated)
      const session = await requireUser();
      if (!session) {
        return NextResponse.json({ setupCompleted: false, completedSteps: [] }, { status: 401 });
      }

      const res = await db.execute(sql`
        SELECT id, setup_completed, config, name, slug, short_name, founded_year FROM leagues
        WHERE id = ${qLeagueId}::uuid
          AND (commissioner_user_id = ${session.userId}::uuid OR commissioner_user_id IS NULL)
        LIMIT 1
      `);
      const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
      if (!row) {
        return NextResponse.json({ setupCompleted: false, completedSteps: [], error: 'League not found' }, { status: 404 });
      }
      const config = (row.config as Record<string, unknown>) || {};
      return NextResponse.json({
        setupCompleted: Boolean(row.setup_completed),
        leagueId: row.id,
        leagueName: row.name ?? null,
        leagueSlug: row.slug ?? null,
        leagueShortName: row.short_name ?? null,
        leagueFoundedYear: row.founded_year ?? null,
        completedSteps: (config.completedSetupSteps as string[]) || [],
      });
    }

    // No explicit leagueId — use the setup cookie or active league cookie
    const jar = await cookies();
    const cookieLeagueId =
      jar.get('setup_league_id')?.value ||
      jar.get('active_league_id')?.value ||
      null;

    if (cookieLeagueId) {
      const res = await db.execute(sql`
        SELECT id, setup_completed, config, name, slug, short_name, founded_year FROM leagues
        WHERE id = ${cookieLeagueId}::uuid
        LIMIT 1
      `);
      const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
      if (row) {
        const config = (row.config as Record<string, unknown>) || {};
        return NextResponse.json({
          setupCompleted: Boolean(row.setup_completed),
          leagueId: row.id,
          leagueName: row.name ?? null,
          leagueSlug: row.slug ?? null,
          leagueShortName: row.short_name ?? null,
          leagueFoundedYear: row.founded_year ?? null,
          completedSteps: (config.completedSetupSteps as string[]) || [],
        });
      }
    }

    // No cookie (new device, cleared cookies, or the 24h setup cookie expired).
    // If the caller is signed in, resume their own most recent in-progress
    // league instead of silently restarting the wizard from scratch — this
    // is what lets a commissioner pick setup back up after an interruption.
    const session = await requireUser();
    if (session) {
      const res = await db.execute(sql`
        SELECT id, setup_completed, config, name, slug, short_name, founded_year FROM leagues
        WHERE commissioner_user_id = ${session.userId}::uuid
          AND setup_completed = false
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
      if (row) {
        const config = (row.config as Record<string, unknown>) || {};
        const response = NextResponse.json({
          setupCompleted: false,
          leagueId: row.id,
          leagueName: row.name ?? null,
          leagueSlug: row.slug ?? null,
          leagueShortName: row.short_name ?? null,
          leagueFoundedYear: row.founded_year ?? null,
          completedSteps: (config.completedSetupSteps as string[]) || [],
        });
        // Re-establish the cookies so the rest of the wizard's steps resolve
        // the same league without needing the leagueId on every request.
        response.cookies.set('setup_league_id', row.id as string, {
          httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24,
        });
        response.cookies.set('active_league_id', row.id as string, {
          httpOnly: false, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
        });
        return response;
      }
    }

    // No league context at all — need full setup
    return NextResponse.json({ setupCompleted: false, completedSteps: [] });
  } catch (error) {
    console.error('[setup/status] Error:', error);
    return NextResponse.json({ setupCompleted: false, completedSteps: [], error: 'Database not ready' });
  }
}
