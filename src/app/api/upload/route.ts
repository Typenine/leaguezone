import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isAdminCookieValue, isSiteAdminCookieValue } from '@/lib/auth/admin';
import { requireUser } from '@/lib/server/session';
import { getActiveLeagueMembership, requireLeagueCommissioner } from '@/lib/server/membership';
import { requireSetupLeagueOwnership } from '@/lib/server/setup-ownership';
import { publicUrl, putObjectBytes } from '@/server/storage/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 5 * 1024 * 1024;
const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

function stableMediaUrl(key: string): string {
  return publicUrl(key) || `/api/media/${key.split('/').map(encodeURIComponent).join('/')}`;
}

async function commissionerLeagueId(): Promise<string | null> {
  try {
    return (await requireLeagueCommissioner()).leagueId;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    const type = String(form.get('type') || '');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Image file is required.' }, { status: 400 });
    const ext = MIME_TO_EXT[file.type];
    if (!ext) return NextResponse.json({ error: 'Use a PNG, JPEG, or WebP image.' }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_BYTES) return NextResponse.json({ error: 'Image must be 5 MB or smaller.' }, { status: 400 });

    const jar = await cookies();
    let leagueId: string | null = null;
    let ownerSegment = 'league';

    if (type === 'league-logo') {
      const setupLeagueId = jar.get('setup_league_id')?.value || null;
      if (setupLeagueId) {
        const session = await requireUser();
        if (!session || !(await requireSetupLeagueOwnership(session.userId, setupLeagueId))) {
          return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
        }
        leagueId = setupLeagueId;
      } else {
        const legacyAdmin = isAdminCookieValue(jar.get('evw_admin')?.value) || isSiteAdminCookieValue(jar.get('site_admin')?.value);
        if (legacyAdmin) {
          leagueId = jar.get('active_league_id')?.value || null;
        } else {
          leagueId = await commissionerLeagueId();
          if (!leagueId) return NextResponse.json({ error: 'Commissioner access required.' }, { status: 403 });
        }
      }
    } else if (type === 'team-logo') {
      const membership = await getActiveLeagueMembership();
      if (!membership.ok) return NextResponse.json({ error: membership.error }, { status: membership.status });
      leagueId = membership.membership.leagueId;
      ownerSegment = membership.membership.rosterId != null
        ? `team-${membership.membership.rosterId}`
        : `team-${membership.membership.userId}`;
    } else if (type === 'history-logo') {
      leagueId = await commissionerLeagueId();
      if (!leagueId) return NextResponse.json({ error: 'Commissioner access required.' }, { status: 403 });
      const season = String(form.get('season') || '').replace(/[^0-9]/g, '').slice(0, 4);
      const franchise = String(form.get('franchiseKey') || '').replace(/[^a-z0-9:_-]/gi, '').slice(0, 128);
      ownerSegment = `history-${season || 'unknown'}-${franchise || 'franchise'}`;
    } else {
      return NextResponse.json({ error: 'Unsupported upload type.' }, { status: 400 });
    }

    if (!leagueId) return NextResponse.json({ error: 'No active league selected.' }, { status: 400 });

    const key = `branding/${leagueId}/${ownerSegment}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    await putObjectBytes({ key, body: await file.arrayBuffer(), contentType: file.type });
    return NextResponse.json({ url: stableMediaUrl(key), key });
  } catch (error) {
    console.error('[api/upload] error', error);
    return NextResponse.json({ error: 'Upload failed.' }, { status: 500 });
  }
}
