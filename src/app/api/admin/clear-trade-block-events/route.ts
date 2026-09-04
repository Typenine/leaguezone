import { NextRequest } from 'next/server';
import { clearAllPendingTradeBlockEvents } from '@/server/db/queries.fixed';
import { isAdminCookieValue, isSiteAdminCookieValue } from '@/lib/auth/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const isAdmin =
    isAdminCookieValue(req.cookies.get('evw_admin')?.value) ||
    isSiteAdminCookieValue(req.cookies.get('site_admin')?.value);
  if (!isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await clearAllPendingTradeBlockEvents();
    return Response.json({ ok: true, message: 'All pending trade block events cleared' });
  } catch (e) {
    console.error('Failed to clear trade block events:', e);
    return Response.json({ error: 'Failed to clear events' }, { status: 500 });
  }
}
