/**
 * GET  /api/settings/podcast – read podcast URLs for active league
 * POST /api/settings/podcast – save podcast URLs (admin)
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  resolveLeagueId,
  getActiveLeagueId,
  getPodcastConfig,
  savePodcastConfig,
  requireNewsletterManager,
} from '@/lib/server/newsletter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const activeLeagueId = await getActiveLeagueId();
    const leagueId = await resolveLeagueId(activeLeagueId);
    if (!leagueId) {
      return NextResponse.json({
        podcast: {
          spotifyUrl: process.env.PODCAST_SPOTIFY_URL || '',
          spotifyEmbedUrl: process.env.PODCAST_SPOTIFY_EMBED_URL || '',
          appleUrl: process.env.PODCAST_APPLE_URL || '',
          appleEmbedUrl: process.env.PODCAST_APPLE_EMBED_URL || '',
          rssFeedUrl: '',
        },
      });
    }
    const podcast = await getPodcastConfig(leagueId);
    return NextResponse.json({ podcast });
  } catch (err) {
    console.error('[settings/podcast] GET error:', err);
    return NextResponse.json({ error: 'Failed to load podcast settings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireNewsletterManager())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const activeLeagueId = await getActiveLeagueId();
    const leagueId = await resolveLeagueId(activeLeagueId);
    if (!leagueId) return NextResponse.json({ error: 'No league found' }, { status: 404 });

    const body = await req.json();
    await savePodcastConfig(leagueId, {
      spotifyUrl: typeof body.spotifyUrl === 'string' ? body.spotifyUrl : undefined,
      spotifyEmbedUrl: typeof body.spotifyEmbedUrl === 'string' ? body.spotifyEmbedUrl : undefined,
      appleUrl: typeof body.appleUrl === 'string' ? body.appleUrl : undefined,
      appleEmbedUrl: typeof body.appleEmbedUrl === 'string' ? body.appleEmbedUrl : undefined,
      rssFeedUrl: typeof body.rssFeedUrl === 'string' ? body.rssFeedUrl : undefined,
    });

    const podcast = await getPodcastConfig(leagueId);
    return NextResponse.json({ ok: true, podcast });
  } catch (err) {
    console.error('[settings/podcast] POST error:', err);
    return NextResponse.json({ error: 'Failed to save podcast settings' }, { status: 500 });
  }
}
