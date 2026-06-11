/**
 * GET  /api/newsletter/episodes – list episodes for active league
 * POST /api/newsletter/episodes – create episode (admin)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import {
  getActiveLeagueId,
  resolveLeagueId,
  listEpisodes,
  getDistinctSeasons,
  episodeToJson,
  getNewsletterManageAccess,
  requireNewsletterManager,
  slugify,
  ensureUniqueSlug,
  sanitizeNewsletterHtml,
  excerptFromHtml,
  type NewsletterSourceType,
  type NewsletterStatus,
} from '@/lib/server/newsletter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const activeLeagueId = await getActiveLeagueId();
    const leagueId = await resolveLeagueId(activeLeagueId);
    if (!leagueId) return NextResponse.json({ episodes: [], seasons: [], canManage: false });

    const { searchParams } = new URL(req.url);
    const seasonParam = searchParams.get('season');
    const season = seasonParam ? parseInt(seasonParam, 10) : undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const access = await getNewsletterManageAccess();

    const episodes = await listEpisodes({
      leagueId,
      season: Number.isFinite(season) ? season : undefined,
      includeDrafts: access.canManage,
      limit,
      offset,
    });
    const seasons = await getDistinctSeasons(leagueId, access.canManage);

    return NextResponse.json({
      episodes: episodes.map((ep) => episodeToJson(ep)),
      seasons,
      canManage: access.canManage,
    });
  } catch (err) {
    console.error('[newsletter/episodes] GET error:', err);
    return NextResponse.json({ error: 'Failed to load episodes' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireNewsletterManager())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

    const activeLeagueId = await getActiveLeagueId();
    const leagueId = await resolveLeagueId(activeLeagueId);
    if (!leagueId) return NextResponse.json({ error: 'No league found' }, { status: 404 });

    const season = typeof body.season === 'number' ? body.season : parseInt(String(body.season || ''), 10);
    if (!Number.isFinite(season)) {
      return NextResponse.json({ error: 'Season is required' }, { status: 400 });
    }

    const week = body.week != null && body.week !== ''
      ? (typeof body.week === 'number' ? body.week : parseInt(String(body.week), 10))
      : null;
    const episodeNumber = typeof body.episodeNumber === 'number'
      ? body.episodeNumber
      : parseInt(String(body.episodeNumber || '1'), 10) || 1;
    const status = (body.status === 'published' ? 'published' : 'draft') as NewsletterStatus;
    const sourceType = (['editor', 'docx', 'html', 'pdf'].includes(body.sourceType)
      ? body.sourceType
      : 'editor') as NewsletterSourceType;
    const contentHtml = typeof body.contentHtml === 'string'
      ? sanitizeNewsletterHtml(body.contentHtml)
      : null;
    const summary = typeof body.summary === 'string' && body.summary.trim()
      ? body.summary.trim()
      : contentHtml
        ? excerptFromHtml(contentHtml)
        : null;
    const sourceFileKey = typeof body.sourceFileKey === 'string' ? body.sourceFileKey.trim() || null : null;
    const coverImageKey = typeof body.coverImageKey === 'string' ? body.coverImageKey.trim() || null : null;
    const publishedAt = status === 'published'
      ? (typeof body.publishedAt === 'string' ? body.publishedAt : new Date().toISOString())
      : null;

    const baseSlug = typeof body.slug === 'string' && body.slug.trim()
      ? slugify(body.slug)
      : slugify(title);
    const slug = await ensureUniqueSlug(leagueId, baseSlug);

    const db = getDb();
    const res = await db.execute(sql`
      INSERT INTO newsletter_episodes (
        league_id, season, week, episode_number, slug, title, summary,
        content_html, source_type, source_file_key, cover_image_key, status, published_at
      ) VALUES (
        ${leagueId}::uuid, ${season}, ${week}, ${episodeNumber}, ${slug}, ${title}, ${summary},
        ${contentHtml}, ${sourceType}, ${sourceFileKey}, ${coverImageKey}, ${status}, ${publishedAt}::timestamptz
      )
      RETURNING *
    `);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    if (!row) return NextResponse.json({ error: 'Create failed' }, { status: 500 });

    return NextResponse.json({
      episode: episodeToJson({
        id: row.id as string,
        leagueId: row.league_id as string,
        season: row.season as number,
        week: (row.week as number | null) ?? null,
        episodeNumber: row.episode_number as number,
        slug: row.slug as string,
        title: row.title as string,
        summary: (row.summary as string | null) ?? null,
        contentHtml: (row.content_html as string | null) ?? null,
        sourceType: row.source_type as NewsletterSourceType,
        sourceFileKey: (row.source_file_key as string | null) ?? null,
        coverImageKey: (row.cover_image_key as string | null) ?? null,
        status: row.status as NewsletterStatus,
        publishedAt: row.published_at ? String(row.published_at) : null,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      }),
    });
  } catch (err) {
    console.error('[newsletter/episodes] POST error:', err);
    return NextResponse.json({ error: 'Failed to create episode' }, { status: 500 });
  }
}
