import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { getYahooConnectionStatus } from '@/lib/server/provider-accounts';
import { isYahooAvailable, isYahooConfigured, isYahooFantasyEnabled } from '@/lib/providers/yahoo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireUser();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const configured = isYahooConfigured();
  const enabled = isYahooFantasyEnabled();
  let connected = false;

  if (configured) {
    try {
      connected = (await getYahooConnectionStatus(session.userId)).connected;
    } catch {
      connected = false;
    }
  }

  return NextResponse.json({
    provider: 'yahoo',
    configured,
    enabled,
    available: isYahooAvailable(),
    connected,
  });
}
