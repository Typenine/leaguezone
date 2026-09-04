import { NextRequest, NextResponse } from 'next/server';
import { getPlayerMediaById } from '@/server/db/queries';
import { getAllPlayersCached } from '@/lib/utils/sleeper-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLEEPER_PLAYER_TTL_MS = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const playerId = req.nextUrl.searchParams.get('playerId');
  if (!playerId) return new NextResponse(null, { status: 404 });

  try {
    const entry = await getPlayerMediaById(playerId);
    const imageUrl = entry?.imageUrl?.trim() || '';

    if (imageUrl) {
      if (imageUrl.startsWith('data:')) {
        const commaIdx = imageUrl.indexOf(',');
        if (commaIdx === -1) return new NextResponse(null, { status: 500 });
        const header = imageUrl.slice(0, commaIdx);
        const base64Data = imageUrl.slice(commaIdx + 1);
        const contentType = header.split(':')[1]?.split(';')[0] || 'image/jpeg';
        const buffer = Buffer.from(base64Data, 'base64');
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'content-type': contentType,
            'cache-control': 'public, max-age=3600',
          },
        });
      }

      if (imageUrl.startsWith('/')) {
        return NextResponse.redirect(new URL(imageUrl, req.nextUrl.origin));
      }

      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return NextResponse.redirect(imageUrl);
      }
    }

    // Sleeper's player payload does not include an image URL, but its CDN keys NFL
    // headshots by Sleeper player ID. Only use this fallback for confirmed Sleeper
    // players so custom/imported player IDs do not produce broken external requests.
    const players = await getAllPlayersCached(SLEEPER_PLAYER_TTL_MS);
    const sleeperPlayer = players[playerId];
    if (!sleeperPlayer || String(sleeperPlayer.position || '').toUpperCase() === 'DEF') {
      return new NextResponse(null, { status: 404 });
    }

    return NextResponse.redirect(`https://sleepercdn.com/content/nfl/players/${encodeURIComponent(playerId)}.jpg`);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}