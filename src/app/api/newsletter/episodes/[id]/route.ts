/**
 * PATCH  /api/newsletter/episodes/[id] – update episode (admin/commish)
 * DELETE /api/newsletter/episodes/[id] – delete episode (admin/commish)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import {
  getEpisodeById,
  slugify,
  ensureUniqueSlug,
  sanitizeNewsletterHtml,
  excerptFromHtml,
  episodeToJson,
  requireNewsletterManager,
  type NewsletterSourceType,
  type NewsletterStatus,
} from '@/lib/server/newsletter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  if (!(await requireNewsletterManager())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const existing = await getEpisodeById(id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json();
    const db = getDb();

    let title = existing.title;
    if (typeof body.title === 'string' && body.title.trim()) title = body.title.trim();

    let slug = existing.slug;
    if (typeof body.slug === 'string' && body.slug.trim()) {
      slug = await ensureUniqueSlug(existing.leagueId, slugify(body.slug), id);
    } else if (title !== existing.title) {
      slug = await ensureUniqueSlug(existing.leagueId, slugify(title), id);
    }

    const season = body.season != null
      ? (typeof body.season === 'number' ? body.season : parseInt(String(body.season), 10))
      : existing.season;
    const week = body.week !== undefined
      ? (body.week == null || body.week === '' ? null : (typeof body.week === 'number' ? body.week : parseInt(String(body.week), 10)))
      : existing.week;
    const episodeNumber = body.episodeNumber != null
      ? (typeof body.episodeNumber === 'number' ? body.episodeNumber : parseInt(String(body.episodeNumber), 10))
      : existing.episodeNumber;
    const status = (body.status === 'published' || body.status === 'draft'
      ? body.status
      : existing.status) as NewsletterStatus;
    const sourceType = (['editor', 'docx', 'html', 'pdf'].includes(body.sourceType)
      ? body.sourceType
      : existing.sourceType) as NewsletterSourceType;

    let contentHtml = existing.contentHtml;
    if (typeof body.contentHtml === 'string') {
      contentHtml = sanitizeNewsletterHtml(body.contentHtml);
    }

    let summary = existing.summary;
    if (typeof body.summary === 'string') {
      summary = body.summary.trim() || (contentHtml ? excerptFromHtml(contentHtml) : null);
    } else if (contentHtml && contentHtml !== existing.contentHtml) {
      summary = excerptFromHtml(contentHtml);
    }

    const sourceFileKey = body.sourceFileKey !== undefined
      ? (typeof body.sourceFileKey === 'string' ? body.sourceFileKey.trim() || null : null)
      : existing.sourceFileKey;
    const coverImageKey = body.coverImageKey !== undefined
      ? (typeof body.coverImageKey === 'string' ? body.coverImageKey.trim() || null : null)
      : existing.coverImageKey;

    let publishedAt = existing.publishedAt;
    if (status === 'published' && !publishedAt) {
      publishedAt = typeof body.publishedAt === 'string' ? body.publishedAt : new Date().toISOString();
    } else if (status === 'draft') {
      publishedAt = null;
    } else if (typeof body.publishedAt === 'string') {
      publishedAt = body.publishedAt;
    }

    const res = await db.execute(sql`
      UPDATE newsletter_episodes SET
        title = ${title},
        slug = ${slug},
        season = ${season},
        week = ${week},
        episode_number = ${episodeNumber},
        summary = ${summary},
        content_html = ${contentHtml},
        source_type = ${sourceType},
        source_file_key = ${sourceFileKey},
        cover_image_key = ${coverImageKey},
        status = ${status},
        published_at = ${publishedAt}::timestamptz,
        updated_at = now()
      WHERE id = ${id}::uuid
      RETURNING *
    `);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    if (!row) return NextResponse.json({ error: 'Update failed' }, { status: 500 });

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
    console.error('[newsletter/episodes/id] PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update episode' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  if (!(await requireNewsletterManager())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const existing = await getEpisodeById(id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const db = getDb();
    await db.execute(sql`DELETE FROM newsletter_episodes WHERE id = ${id}::uuid`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[newsletter/episodes/id] DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete episode' }, { status: 500 });
  }
}
