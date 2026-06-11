/**
 * GET /api/newsletter/episodes/by-slug/[slug] – single episode + prev/next
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  resolveLeagueId,
  getActiveLeagueId,
  getEpisodeBySlug,
  getAdjacentEpisodes,
  getMediaUrl,
  episodeToJson,
  getNewsletterManageAccess,
} from '@/lib/server/newsletter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const access = await getNewsletterManageAccess();
    const activeLeagueId = await getActiveLeagueId();
    const leagueId = await resolveLeagueId(activeLeagueId);
    if (!leagueId) return NextResponse.json({ error: 'No league found' }, { status: 404 });

    const episode = await getEpisodeBySlug(leagueId, slug, access.canManage);
    if (!episode) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const adjacent = await getAdjacentEpisodes(leagueId, episode);
    const sourceFileUrl = episode.sourceFileKey ? await getMediaUrl(episode.sourceFileKey) : null;
    const coverImageUrl = episode.coverImageKey ? await getMediaUrl(episode.coverImageKey) : null;

    return NextResponse.json({
      episode: episodeToJson(episode, { sourceFileUrl, coverImageUrl }),
      prev: adjacent.prev,
      next: adjacent.next,
      canManage: access.canManage,
    });
  } catch (err) {
    console.error('[newsletter/episodes/by-slug] GET error:', err);
    return NextResponse.json({ error: 'Failed to load episode' }, { status: 500 });
  }
}
