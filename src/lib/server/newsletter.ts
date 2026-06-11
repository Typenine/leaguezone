import { cookies } from 'next/headers';
import DOMPurify from 'isomorphic-dompurify';
import mammoth from 'mammoth';
import { getDb } from '@/server/db/client';
import { sql } from 'drizzle-orm';
import { getObjectBytes, getObjectText, publicUrl, presignGet, putObjectBytes, putObjectText } from '@/server/storage/r2';
import { isAdminCookieValue, isSiteAdminCookieValue } from '@/lib/auth/admin';
import { verifySession } from '@/lib/server/auth';
import { getUserById, getUserLeagues } from '@/lib/server/user-auth';

export type NewsletterManageAccess = {
  canManage: boolean;
  isAdmin: boolean;
  isCommissioner: boolean;
  authenticated: boolean;
};

export async function getNewsletterManageAccess(): Promise<NewsletterManageAccess> {
  const jar = await cookies();
  const isSiteAdmin = isSiteAdminCookieValue(jar.get('site_admin')?.value);
  const isAdminCookie = isAdminCookieValue(jar.get('evw_admin')?.value) || isSiteAdmin;

  // League admin PIN / site admin (Admin Mode) — same gate as Settings admin sections
  if (isAdminCookie) {
    const token = jar.get('evw_session')?.value || '';
    const authenticated = Boolean(token && verifySession(token));
    return { canManage: true, isAdmin: true, isCommissioner: false, authenticated };
  }

  const token = jar.get('evw_session')?.value || '';
  if (!token) {
    return { canManage: false, isAdmin: false, isCommissioner: false, authenticated: false };
  }

  const claims = verifySession(token);
  if (!claims) {
    return { canManage: false, isAdmin: false, isCommissioner: false, authenticated: false };
  }

  if (claims.type !== 'user') {
    return { canManage: false, isAdmin: false, isCommissioner: false, authenticated: true };
  }

  const userId = claims.sub as string;
  const [user, leagues] = await Promise.all([
    getUserById(userId),
    getUserLeagues(userId),
  ]);
  if (!user) {
    return { canManage: false, isAdmin: false, isCommissioner: false, authenticated: false };
  }

  const admin = user.role === 'admin';
  const activeLeagueId = jar.get('active_league_id')?.value || undefined;
  const resolvedLeagueId = await resolveLeagueId(activeLeagueId);
  const isCommissioner = resolvedLeagueId
    ? leagues.some((l) => l.leagueId === resolvedLeagueId && l.isCommissioner)
    : leagues.some((l) => l.isCommissioner);

  return {
    canManage: admin || isCommissioner,
    isAdmin: admin,
    isCommissioner,
    authenticated: true,
  };
}

export async function requireNewsletterManager(): Promise<boolean> {
  const access = await getNewsletterManageAccess();
  return access.canManage;
}

export type NewsletterSourceType = 'editor' | 'docx' | 'html' | 'pdf';
export type NewsletterStatus = 'draft' | 'published';

export type NewsletterEpisodeRow = {
  id: string;
  leagueId: string;
  season: number;
  week: number | null;
  episodeNumber: number;
  slug: string;
  title: string;
  summary: string | null;
  contentHtml: string | null;
  sourceType: NewsletterSourceType;
  sourceFileKey: string | null;
  coverImageKey: string | null;
  status: NewsletterStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PodcastConfig = {
  spotifyUrl: string;
  spotifyEmbedUrl: string;
  appleUrl: string;
  appleEmbedUrl: string;
  rssFeedUrl: string;
};

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
    'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'u', 's', 'sub', 'sup',
    'a', 'img', 'blockquote', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'div', 'span', 'figure', 'figcaption',
  ],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel', 'width', 'height', 'colspan', 'rowspan'],
};

export async function getActiveLeagueId(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get('active_league_id')?.value || undefined;
}

export async function resolveLeagueId(preferred?: string): Promise<string | null> {
  const db = getDb();
  if (preferred) {
    const res = await db.execute(sql`
      SELECT id FROM leagues WHERE setup_completed = true AND id = ${preferred}::uuid LIMIT 1
    `);
    const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    const id = row?.id as string | undefined;
    if (id) return id;
  }
  const res = await db.execute(sql`
    SELECT id FROM leagues WHERE setup_completed = true ORDER BY created_at DESC LIMIT 1
  `);
  const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
  return (row?.id as string | undefined) ?? null;
}

export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  return base || 'issue';
}

export function sanitizeNewsletterHtml(html: string): string {
  return DOMPurify.sanitize(html, PURIFY_CONFIG);
}

export function excerptFromHtml(html: string, maxLen = 200): string {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen).trim()}…`;
}

export async function ensureUniqueSlug(leagueId: string, baseSlug: string, excludeId?: string): Promise<string> {
  const db = getDb();
  let slug = baseSlug;
  let n = 2;
  while (true) {
    const res = excludeId
      ? await db.execute(sql`
          SELECT id FROM newsletter_episodes
          WHERE league_id = ${leagueId}::uuid AND slug = ${slug} AND id != ${excludeId}::uuid
          LIMIT 1
        `)
      : await db.execute(sql`
          SELECT id FROM newsletter_episodes
          WHERE league_id = ${leagueId}::uuid AND slug = ${slug}
          LIMIT 1
        `);
    const exists = (res as { rows?: unknown[] }).rows?.length;
    if (!exists) return slug;
    slug = `${baseSlug}-${n}`;
    n += 1;
  }
}

function mapRow(row: Record<string, unknown>): NewsletterEpisodeRow {
  return {
    id: row.id as string,
    leagueId: row.league_id as string,
    season: row.season as number,
    week: (row.week as number | null) ?? null,
    episodeNumber: (row.episode_number as number) ?? 1,
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
  };
}

export async function getMediaUrl(key: string | null): Promise<string | null> {
  if (!key) return null;
  if (key.startsWith('http://') || key.startsWith('https://')) return key;
  const pub = publicUrl(key);
  if (pub) return pub;
  try {
    return await presignGet({ key, expiresSec: 3600 });
  } catch {
    return `/api/media/${encodeURIComponent(key)}`;
  }
}

export async function convertDocxFromR2(fileKey: string): Promise<string> {
  const bytes = await getObjectBytes({ key: fileKey });
  if (!bytes) throw new Error('Could not read uploaded file');
  const result = await mammoth.convertToHtml({ buffer: bytes });
  return sanitizeNewsletterHtml(result.value);
}

export async function convertHtmlFromR2(fileKey: string): Promise<string> {
  const text = await getObjectText({ key: fileKey });
  if (!text) throw new Error('Could not read uploaded file');
  return sanitizeNewsletterHtml(text);
}

export function detectSourceType(fileKey: string): NewsletterSourceType {
  const lower = fileKey.toLowerCase();
  if (lower.endsWith('.docx')) return 'docx';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  if (lower.endsWith('.pdf')) return 'pdf';
  return 'html';
}

export async function convertUploadedFile(fileKey: string, sourceType: NewsletterSourceType): Promise<string | null> {
  if (sourceType === 'docx') return convertDocxFromR2(fileKey);
  if (sourceType === 'html') return convertHtmlFromR2(fileKey);
  return null;
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') return true;
  const parts = host.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

/** Rewrite common Google Docs share links to a public HTML export URL. */
export function normalizeImportUrl(raw: string): string {
  const trimmed = raw.trim();
  const url = new URL(trimmed);
  const docsMatch = url.pathname.match(/^\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (url.hostname === 'docs.google.com' && docsMatch) {
    const id = docsMatch[1];
    const format = url.searchParams.get('format');
    if (format === 'docx' || format === 'pdf') {
      return `https://docs.google.com/document/d/${id}/export?format=${format}`;
    }
    return `https://docs.google.com/document/d/${id}/export?format=html`;
  }
  return url.toString();
}

export function assertSafeImportUrl(urlStr: string): URL {
  const url = new URL(urlStr);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('URL must use http or https');
  }
  if (isPrivateHostname(url.hostname)) {
    throw new Error('Local or private network URLs are not allowed');
  }
  return url;
}

function detectSourceTypeFromFetch(url: URL, contentType: string): NewsletterSourceType {
  const path = url.pathname.toLowerCase();
  const format = url.searchParams.get('format')?.toLowerCase();
  const ct = contentType.toLowerCase();

  if (format === 'docx' || path.endsWith('.docx') || ct.includes('wordprocessingml')) return 'docx';
  if (format === 'pdf' || path.endsWith('.pdf') || ct.includes('application/pdf')) return 'pdf';
  return 'html';
}

/** Fetch a public URL, store a copy in R2, and return the key + detected source type. */
export async function fetchAndStoreImportUrl(sourceUrl: string): Promise<{ fileKey: string; sourceType: NewsletterSourceType }> {
  const normalized = normalizeImportUrl(sourceUrl);
  assertSafeImportUrl(normalized);
  const url = new URL(normalized);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(normalized, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'EvW-Newsletter-Importer/1.0', Accept: '*/*' },
    });
    if (!res.ok) {
      throw new Error(`Could not fetch URL (HTTP ${res.status}). Make sure the link is public.`);
    }

    const sourceType = detectSourceTypeFromFetch(url, res.headers.get('content-type') || '');
    const ext = sourceType === 'docx' ? 'docx' : sourceType === 'pdf' ? 'pdf' : 'html';
    const fileKey = `newsletters/url-imports/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    if (sourceType === 'html') {
      const text = await res.text();
      if (!text.trim()) throw new Error('URL returned empty content');
      await putObjectText({ key: fileKey, text });
    } else {
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length === 0) throw new Error('URL returned empty content');
      const contentType = sourceType === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      await putObjectBytes({ key: fileKey, body: bytes, contentType });
    }

    return { fileKey, sourceType };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('URL fetch timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function listEpisodes(params: {
  leagueId: string;
  season?: number;
  status?: NewsletterStatus | 'all';
  includeDrafts?: boolean;
  limit?: number;
  offset?: number;
}): Promise<NewsletterEpisodeRow[]> {
  const db = getDb();
  const limit = Math.min(100, Math.max(1, params.limit ?? 50));
  const offset = Math.max(0, params.offset ?? 0);

  let query;
  if (params.season != null && params.includeDrafts) {
    query = sql`
      SELECT * FROM newsletter_episodes
      WHERE league_id = ${params.leagueId}::uuid AND season = ${params.season}
      ORDER BY COALESCE(published_at, created_at) DESC, episode_number DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else if (params.season != null) {
    query = sql`
      SELECT * FROM newsletter_episodes
      WHERE league_id = ${params.leagueId}::uuid AND season = ${params.season} AND status = 'published'
      ORDER BY COALESCE(published_at, created_at) DESC, episode_number DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else if (params.includeDrafts) {
    query = sql`
      SELECT * FROM newsletter_episodes
      WHERE league_id = ${params.leagueId}::uuid
      ORDER BY COALESCE(published_at, created_at) DESC, episode_number DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  } else {
    query = sql`
      SELECT * FROM newsletter_episodes
      WHERE league_id = ${params.leagueId}::uuid AND status = 'published'
      ORDER BY COALESCE(published_at, created_at) DESC, episode_number DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  const res = await db.execute(query);
  const rows = (res as { rows?: Array<Record<string, unknown>> }).rows ?? [];
  return rows.map(mapRow);
}

export async function getEpisodeBySlug(
  leagueId: string,
  slug: string,
  includeDrafts = false,
): Promise<NewsletterEpisodeRow | null> {
  const db = getDb();
  const res = includeDrafts
    ? await db.execute(sql`
        SELECT * FROM newsletter_episodes
        WHERE league_id = ${leagueId}::uuid AND slug = ${slug}
        LIMIT 1
      `)
    : await db.execute(sql`
        SELECT * FROM newsletter_episodes
        WHERE league_id = ${leagueId}::uuid AND slug = ${slug} AND status = 'published'
        LIMIT 1
      `);
  const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
  return row ? mapRow(row) : null;
}

export async function getEpisodeById(id: string): Promise<NewsletterEpisodeRow | null> {
  const db = getDb();
  const res = await db.execute(sql`
    SELECT * FROM newsletter_episodes WHERE id = ${id}::uuid LIMIT 1
  `);
  const row = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0];
  return row ? mapRow(row) : null;
}

export async function getAdjacentEpisodes(
  leagueId: string,
  episode: NewsletterEpisodeRow,
): Promise<{ prev: { slug: string; title: string } | null; next: { slug: string; title: string } | null }> {
  const db = getDb();
  const ts = episode.publishedAt || episode.createdAt;

  const prevRes = await db.execute(sql`
    SELECT slug, title FROM newsletter_episodes
    WHERE league_id = ${leagueId}::uuid AND status = 'published'
      AND COALESCE(published_at, created_at) > ${ts}::timestamptz
    ORDER BY COALESCE(published_at, created_at) ASC
    LIMIT 1
  `);
  const nextRes = await db.execute(sql`
    SELECT slug, title FROM newsletter_episodes
    WHERE league_id = ${leagueId}::uuid AND status = 'published'
      AND COALESCE(published_at, created_at) < ${ts}::timestamptz
    ORDER BY COALESCE(published_at, created_at) DESC
    LIMIT 1
  `);

  const prevRow = (prevRes as { rows?: Array<Record<string, unknown>> }).rows?.[0];
  const nextRow = (nextRes as { rows?: Array<Record<string, unknown>> }).rows?.[0];
  return {
    prev: prevRow ? { slug: prevRow.slug as string, title: prevRow.title as string } : null,
    next: nextRow ? { slug: nextRow.slug as string, title: nextRow.title as string } : null,
  };
}

export async function getDistinctSeasons(leagueId: string, includeDrafts = false): Promise<number[]> {
  const db = getDb();
  const res = includeDrafts
    ? await db.execute(sql`
        SELECT DISTINCT season FROM newsletter_episodes
        WHERE league_id = ${leagueId}::uuid
        ORDER BY season DESC
      `)
    : await db.execute(sql`
        SELECT DISTINCT season FROM newsletter_episodes
        WHERE league_id = ${leagueId}::uuid AND status = 'published'
        ORDER BY season DESC
      `);
  const rows = (res as { rows?: Array<Record<string, unknown>> }).rows ?? [];
  return rows.map((r) => r.season as number);
}

export async function getPodcastConfig(leagueId: string): Promise<PodcastConfig> {
  const defaults: PodcastConfig = {
    spotifyUrl: process.env.PODCAST_SPOTIFY_URL || 'https://open.spotify.com',
    spotifyEmbedUrl: process.env.PODCAST_SPOTIFY_EMBED_URL || '',
    appleUrl: process.env.PODCAST_APPLE_URL || 'https://podcasts.apple.com',
    appleEmbedUrl: process.env.PODCAST_APPLE_EMBED_URL || '',
    rssFeedUrl: '',
  };
  try {
    const db = getDb();
    const res = await db.execute(sql`
      SELECT config FROM leagues WHERE id = ${leagueId}::uuid LIMIT 1
    `);
    const config = (res as { rows?: Array<Record<string, unknown>> }).rows?.[0]?.config as Record<string, unknown> | null | undefined;
    const podcast = (config?.podcast ?? {}) as Partial<PodcastConfig>;
    return {
      spotifyUrl: podcast.spotifyUrl?.trim() || defaults.spotifyUrl,
      spotifyEmbedUrl: podcast.spotifyEmbedUrl?.trim() || defaults.spotifyEmbedUrl,
      appleUrl: podcast.appleUrl?.trim() || defaults.appleUrl,
      appleEmbedUrl: podcast.appleEmbedUrl?.trim() || defaults.appleEmbedUrl,
      rssFeedUrl: podcast.rssFeedUrl?.trim() || '',
    };
  } catch {
    return defaults;
  }
}

export async function savePodcastConfig(leagueId: string, podcast: Partial<PodcastConfig>): Promise<void> {
  const db = getDb();
  const current = await getPodcastConfig(leagueId);
  const merged: PodcastConfig = {
    spotifyUrl: typeof podcast.spotifyUrl === 'string' ? podcast.spotifyUrl.trim() : current.spotifyUrl,
    spotifyEmbedUrl: typeof podcast.spotifyEmbedUrl === 'string' ? podcast.spotifyEmbedUrl.trim() : current.spotifyEmbedUrl,
    appleUrl: typeof podcast.appleUrl === 'string' ? podcast.appleUrl.trim() : current.appleUrl,
    appleEmbedUrl: typeof podcast.appleEmbedUrl === 'string' ? podcast.appleEmbedUrl.trim() : current.appleEmbedUrl,
    rssFeedUrl: typeof podcast.rssFeedUrl === 'string' ? podcast.rssFeedUrl.trim() : current.rssFeedUrl,
  };
  await db.execute(sql`
    UPDATE leagues
    SET config = COALESCE(config, '{}'::jsonb) || jsonb_build_object('podcast', ${JSON.stringify(merged)}::jsonb),
        updated_at = now()
    WHERE id = ${leagueId}::uuid
  `);
}

export function episodeToJson(ep: NewsletterEpisodeRow, extras?: Record<string, unknown>) {
  return {
    id: ep.id,
    leagueId: ep.leagueId,
    season: ep.season,
    week: ep.week,
    episodeNumber: ep.episodeNumber,
    slug: ep.slug,
    title: ep.title,
    summary: ep.summary,
    contentHtml: ep.contentHtml,
    sourceType: ep.sourceType,
    sourceFileKey: ep.sourceFileKey,
    coverImageKey: ep.coverImageKey,
    status: ep.status,
    publishedAt: ep.publishedAt,
    createdAt: ep.createdAt,
    updatedAt: ep.updatedAt,
    ...extras,
  };
}
