/**
 * POST /api/newsletter/import – convert uploaded file and create episode (admin)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import {
  resolveLeagueId,
  getActiveLeagueId,
  slugify,
  ensureUniqueSlug,
  excerptFromHtml,
  detectSourceType,
  convertUploadedFile,
  episodeToJson,
  requireNewsletterManager,
  fetchAndStoreImportUrl,
  type NewsletterSourceType,
  type NewsletterStatus,
} from '@/lib/server/newsletter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!(await requireNewsletterManager())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const sourceUrl = typeof body.sourceUrl === 'string' ? body.sourceUrl.trim() : '';
    let fileKey = typeof body.fileKey === 'string' ? body.fileKey.trim() : '';
    if (!fileKey && !sourceUrl) {
      return NextResponse.json({ error: 'fileKey or sourceUrl is required' }, { status: 400 });
    }

    let sourceType = (body.sourceType && ['editor', 'docx', 'html', 'pdf'].includes(body.sourceType)
      ? body.sourceType
      : undefined) as NewsletterSourceType | undefined;

    if (sourceUrl) {
      const fetched = await fetchAndStoreImportUrl(sourceUrl);
      fileKey = fetched.fileKey;
      sourceType = fetched.sourceType;
    } else if (!sourceType) {
      sourceType = detectSourceType(fileKey);
    }

    const activeLeagueId = await getActiveLeagueId();
    const leagueId = await resolveLeagueId(activeLeagueId);
    if (!leagueId) return NextResponse.json({ error: 'No league found' }, { status: 404 });

    let contentHtml: string | null = null;
    if (sourceType !== 'pdf') {
      contentHtml = await convertUploadedFile(fileKey, sourceType);
    }

    const filename = fileKey.split('/').pop() || 'Newsletter';
    const defaultTitle = filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
    const title = typeof body.title === 'string' && body.title.trim()
      ? body.title.trim()
      : defaultTitle || 'Newsletter Issue';

    const season = typeof body.season === 'number'
      ? body.season
      : parseInt(String(body.season || ''), 10);
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
    const summary = contentHtml ? excerptFromHtml(contentHtml) : null;
    const slug = await ensureUniqueSlug(leagueId, slugify(title));
    const publishedAt = status === 'published'
      ? (typeof body.publishedAt === 'string' ? body.publishedAt : new Date().toISOString())
      : null;

    const db = getDb();
    const res = await db.execute(sql`
      INSERT INTO newsletter_episodes (
        league_id, season, week, episode_number, slug, title, summary,
        content_html, source_type, source_file_key, status, published_at
      ) VALUES (
        ${leagueId}::uuid, ${season}, ${week}, ${episodeNumber}, ${slug}, ${title}, ${summary},
        ${contentHtml}, ${sourceType}, ${fileKey}, ${status}, ${publishedAt}::timestamptz
      )
      RETURNING *
    `);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    if (!row) return NextResponse.json({ error: 'Import failed' }, { status: 500 });

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
        sourceFileKey: row.source_file_key as string,
        coverImageKey: null,
        status: row.status as NewsletterStatus,
        publishedAt: row.published_at ? String(row.published_at) : null,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      }),
    });
  } catch (err) {
    console.error('[newsletter/import] POST error:', err);
    const msg = err instanceof Error ? err.message : 'Import failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
