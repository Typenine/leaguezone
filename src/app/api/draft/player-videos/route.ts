import { NextRequest } from 'next/server';
import {
  ensureDraftTables,
  getActiveOrLatestDraftId,
  getDraftOverview,
  getPlayerMediaSummaries,
  setPlayerVideo,
  setPlayerImage,
  deletePlayerVideo,
} from '@/server/db/queries';
import { getAllPlayersCached } from '@/lib/utils/sleeper-api';
import { isAdminCookieValue } from '@/lib/auth/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLEEPER_PLAYER_TTL_MS = 24 * 60 * 60 * 1000;

function ok(data: unknown) { return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } }); }
function bad(msg: string, status = 400) { return new Response(JSON.stringify({ error: msg }), { status, headers: { 'content-type': 'application/json' } }); }

function isAdmin(req: NextRequest): boolean {
  return isAdminCookieValue(req.cookies.get('evw_admin')?.value);
}

export async function GET() {
  try {
    await ensureDraftTables();
    // getPlayerMediaSummaries() uses DB-side boolean expressions and CASE/LIKE guards so
    // image_url and video_url full text values are never selected — no base64 data crosses
    // the Neon wire even when stored media is large.
    const videos = await getPlayerMediaSummaries();

    // Draft animations already consume this compact media index. Mark confirmed Sleeper
    // players as having an image even when no manual override exists so the existing
    // /api/draft/player-image endpoint can serve the Sleeper CDN fallback.
    try {
      const draftId = await getActiveOrLatestDraftId();
      const overview = draftId ? await getDraftOverview(draftId) : null;
      const picks = overview?.allPicks || overview?.recentPicks || [];
      if (picks.length > 0) {
        const players = await getAllPlayersCached(SLEEPER_PLAYER_TTL_MS);
        const byId = new Map(videos.map((entry) => [entry.playerId, entry]));
        for (const pick of picks) {
          const sleeperPlayer = players[pick.playerId];
          if (!sleeperPlayer || String(sleeperPlayer.position || '').toUpperCase() === 'DEF') continue;
          const existing = byId.get(pick.playerId);
          if (existing) {
            existing.hasImage = true;
          } else {
            const entry = {
              playerId: pick.playerId,
              playerName: pick.playerName || null,
              hasImage: true,
              hasVideo: false,
              videoUrl: null,
            };
            videos.push(entry);
            byId.set(pick.playerId, entry);
          }
        }
      }
    } catch (error) {
      console.warn('[draft/player-videos] Sleeper headshot enrichment unavailable', error);
    }

    return ok({ videos });
  } catch (e) {
    console.error('GET /api/draft/player-videos failed', e);
    return ok({ videos: [] });
  }
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return bad('Unauthorized', 403);
  try {
    const body = await req.json().catch(() => null);
    if (!body?.playerId) return bad('playerId required');

    if (body.action === 'delete') {
      await deletePlayerVideo(body.playerId);
      return ok({ ok: true });
    }

    if (body.imageUrl) {
      if (typeof body.imageUrl === 'string' && body.imageUrl.startsWith('data:')) {
        return bad('data: URLs are not allowed. Host the image externally and submit its URL.');
      }
      await setPlayerImage(body.playerId, body.imageUrl, body.playerName ?? null);
      return ok({ ok: true });
    }

    if (!body.videoUrl) return bad('videoUrl or imageUrl required');
    if (typeof body.videoUrl === 'string' && body.videoUrl.startsWith('data:')) {
      return bad('data: URLs are not allowed. Host the video externally and submit its URL.');
    }
    await setPlayerVideo(body.playerId, body.videoUrl, body.playerName ?? null);
    return ok({ ok: true });
  } catch (e) {
    console.error('POST /api/draft/player-videos failed', e);
    return bad('internal error', 500);
  }
}