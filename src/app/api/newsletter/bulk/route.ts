/**
 * POST /api/newsletter/bulk – batch import uploaded files (admin)
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
  type NewsletterSourceType,
  type NewsletterStatus,
} from '@/lib/server/newsletter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type BulkItem = {
  fileKey: string;
  title?: string;
  season: number;
  week?: number | null;
  episodeNumber?: number;
  status?: NewsletterStatus;
  publishedAt?: string;
  sourceType?: NewsletterSourceType;
};

export async function POST(req: NextRequest) {
  if (!(await requireNewsletterManager())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const items = Array.isArray(body.items) ? body.items as BulkItem[] : [];
    if (items.length === 0) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 });
    }
    if (items.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 items per bulk import' }, { status: 400 });
    }

    const activeLeagueId = await getActiveLeagueId();
    const leagueId = await resolveLeagueId(activeLeagueId);
    if (!leagueId) return NextResponse.json({ error: 'No league found' }, { status: 404 });

    const defaultStatus = body.status === 'published' ? 'published' : 'draft';
    const db = getDb();
    const created = [];
    const errors: Array<{ fileKey: string; error: string }> = [];

    for (const item of items) {
      try {
        const fileKey = typeof item.fileKey === 'string' ? item.fileKey.trim() : '';
        if (!fileKey) throw new Error('Missing fileKey');

        const sourceType = (item.sourceType && ['editor', 'docx', 'html', 'pdf'].includes(item.sourceType)
          ? item.sourceType
          : detectSourceType(fileKey)) as NewsletterSourceType;

        let contentHtml: string | null = null;
        if (sourceType !== 'pdf') {
          contentHtml = await convertUploadedFile(fileKey, sourceType);
        }

        const filename = fileKey.split('/').pop() || 'Newsletter';
        const defaultTitle = filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
        const title = typeof item.title === 'string' && item.title.trim()
          ? item.title.trim()
          : defaultTitle || 'Newsletter Issue';

        const season = typeof item.season === 'number' ? item.season : parseInt(String(item.season), 10);
        if (!Number.isFinite(season)) throw new Error('Invalid season');

        const week = item.week != null
          ? (typeof item.week === 'number' ? item.week : parseInt(String(item.week), 10))
          : null;
        const episodeNumber = typeof item.episodeNumber === 'number'
          ? item.episodeNumber
          : parseInt(String(item.episodeNumber || '1'), 10) || 1;
        const status = (item.status === 'published' || item.status === 'draft'
          ? item.status
          : defaultStatus) as NewsletterStatus;
        const summary = contentHtml ? excerptFromHtml(contentHtml) : null;
        const slug = await ensureUniqueSlug(leagueId, slugify(title));
        const publishedAt = status === 'published'
          ? (typeof item.publishedAt === 'string' ? item.publishedAt : new Date().toISOString())
          : null;

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
        if (!row) throw new Error('Insert failed');

        created.push(episodeToJson({
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
        }));
      } catch (e) {
        errors.push({
          fileKey: item.fileKey || '',
          error: e instanceof Error ? e.message : 'Failed',
        });
      }
    }

    return NextResponse.json({ created, errors, count: created.length });
  } catch (err) {
    console.error('[newsletter/bulk] POST error:', err);
    return NextResponse.json({ error: 'Bulk import failed' }, { status: 500 });
  }
}
