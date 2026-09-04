import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { requireUser } from '@/lib/server/session';
import { requireSetupLeagueOwnership } from '@/lib/server/setup-ownership';
import { normalizeBrandImageUrl, normalizeHexColor } from '@/lib/branding/colors';

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
    const rawPrimary = typeof body.primaryColor === 'string' ? body.primaryColor.trim() : '';
    const rawSecondary = typeof body.secondaryColor === 'string' ? body.secondaryColor.trim() : '';
    const rawLogo = typeof body.logoUrl === 'string' ? body.logoUrl.trim() : '';
    const primaryColor = rawPrimary ? normalizeHexColor(rawPrimary) : null;
    const secondaryColor = rawSecondary ? normalizeHexColor(rawSecondary) : null;
    const logoUrl = rawLogo ? normalizeBrandImageUrl(rawLogo) : null;
    const bodyLeagueId = typeof body.leagueId === 'string' ? body.leagueId : null;

    if (rawPrimary && !primaryColor) {
      return NextResponse.json({ error: 'Primary color must be a valid hex color.' }, { status: 400 });
    }
    if (rawSecondary && !secondaryColor) {
      return NextResponse.json({ error: 'Secondary color must be a valid hex color.' }, { status: 400 });
    }
    if (rawLogo && !logoUrl) {
      return NextResponse.json({ error: 'Logo URL must be an http(s) URL or a site-relative path.' }, { status: 400 });
    }

    const jar = await cookies();
    const leagueId =
      bodyLeagueId ||
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

    await db.execute(sql`
      UPDATE leagues SET
        primary_color = ${primaryColor},
        secondary_color = ${secondaryColor},
        logo_url = ${logoUrl},
        config = jsonb_set(
          COALESCE(config, '{}'),
          '{completedSetupSteps}',
          (
            SELECT CASE
              WHEN COALESCE(config->'completedSetupSteps', '[]'::jsonb) ? 'branding'
                THEN COALESCE(config->'completedSetupSteps', '[]'::jsonb)
              ELSE COALESCE(config->'completedSetupSteps', '[]'::jsonb) || '["branding"]'::jsonb
            END
            FROM leagues WHERE id = ${leagueId}::uuid
          )
        ),
        updated_at = now()
      WHERE id = ${leagueId}::uuid
    `);

    return NextResponse.json({ success: true, leagueId });
  } catch (error) {
    console.error('[setup/branding] Error:', error);
    return NextResponse.json({ error: 'Failed to save branding' }, { status: 500 });
  }
}
